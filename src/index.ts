import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ---------- JWT middleware (token HTTPOnly cookie theke ashbe) ----------
type AuthUser = { email: string; name: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: please log in" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as AuthUser;
    req.user = { email: decoded.email, name: decoded.name };
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized: invalid or expired token" });
  }
};

// ---------- MongoDB ----------
const client = new MongoClient(process.env.MONGODB_URI as string, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function run() {
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME);

    const studiosCollection = db.collection("studios");
    const bookingsCollection = db.collection("bookings");
    const wishlistCollection = db.collection("wishlist");

    // ===== STUDIOS ROUTES =====

    // GET /studios?search=&category=&sort=&limit=&minPrice=&maxPrice=
    app.get("/studios", async (req, res) => {
      const { search, category, sort, limit, minPrice, maxPrice } = req.query as Record<string, string | undefined>;

      const filter: any = {};
      if (category) filter.category = category;
      if (search) {
        const rx = new RegExp(escapeRegex(search), "i");
        filter.$or = [{ title: rx }, { location: rx }];
      }
      if (minPrice || maxPrice) {
        filter.hourlyRate = {};
        if (minPrice) filter.hourlyRate.$gte = Number(minPrice);
        if (maxPrice) filter.hourlyRate.$lte = Number(maxPrice);
      }

      const sortMap: Record<string, any> = {
        newest: { createdAt: -1 },
        rating: { rating: -1 },
        "price-asc": { hourlyRate: 1 },
        "price-desc": { hourlyRate: -1 },
      };

      let cursor = studiosCollection.find(filter).sort(sortMap[sort || "newest"] || { createdAt: -1 });
      if (limit) cursor = cursor.limit(Number(limit));

      res.json(await cursor.toArray());
    });

    // Logged-in user er nijer studio. /studios/:id er age thakte hobe
    app.get("/studios/my", requireAuth, async (req, res) => {
      const list = await studiosCollection
        .find({ ownerEmail: req.user!.email })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(list);
    });

    app.get("/studios/:id", async (req, res) => {
      const id = String(req.params.id);
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid studio id" });
      }
      const studio = await studiosCollection.findOne({ _id: new ObjectId(id) });
      if (!studio) return res.status(404).json({ message: "Studio not found" });
      res.json(studio);
    });

    app.post("/studios", requireAuth, async (req, res) => {
      const b = req.body;
      if (!b.title || !b.category || !b.hourlyRate || !b.location || !b.image) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const doc = {
        title: b.title,
        category: b.category,
        hourlyRate: Number(b.hourlyRate),
        securityDeposit: Number(b.securityDeposit || 0),
        maxCapacity: Number(b.maxCapacity || 1),
        location: b.location,
        image: b.image,
        gallery: Array.isArray(b.gallery) && b.gallery.length ? b.gallery : [b.image],
        amenities: Array.isArray(b.amenities) ? b.amenities : [],
        overview: b.overview || "",
        rating: 0,
        reviews: [],
        ownerEmail: req.user!.email, // token theke, body theke na
        ownerName: req.user!.name,
        createdAt: new Date(),
      };
      const result = await studiosCollection.insertOne(doc);
      res.status(201).json({ insertedId: result.insertedId });
    });

    app.put("/studios/:id", requireAuth, async (req, res) => {
      const id = String(req.params.id);
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid studio id" });
      }
      const _id = new ObjectId(id);
      const existing = await studiosCollection.findOne({ _id });
      if (!existing) return res.status(404).json({ message: "Studio not found" });
      if (existing.ownerEmail !== req.user!.email) {
        return res.status(403).json({ message: "You can only edit your own studios" });
      }
      const b = req.body;
      await studiosCollection.updateOne(
        { _id },
        {
          $set: {
            title: b.title,
            category: b.category,
            hourlyRate: Number(b.hourlyRate),
            securityDeposit: Number(b.securityDeposit || 0),
            maxCapacity: Number(b.maxCapacity || 1),
            location: b.location,
            image: b.image,
            gallery: Array.isArray(b.gallery) && b.gallery.length ? b.gallery : [b.image],
            amenities: Array.isArray(b.amenities) ? b.amenities : [],
            overview: b.overview || "",
            updatedAt: new Date(),
          },
        }
      );
      res.json({ message: "Studio updated" });
    });

    app.delete("/studios/:id", requireAuth, async (req, res) => {
      const id = String(req.params.id);
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid studio id" });
      }
      const _id = new ObjectId(id);
      const existing = await studiosCollection.findOne({ _id });
      if (!existing) return res.status(404).json({ message: "Studio not found" });
      if (existing.ownerEmail !== req.user!.email) {
        return res.status(403).json({ message: "You can only delete your own studios" });
      }
      await studiosCollection.deleteOne({ _id });
      res.json({ message: "Studio deleted" });
    });

    // ===== BOOKINGS ROUTES =====

    // Overlap logic: existing.start < new.end AND existing.end > new.start
    const findConfirmedOverlap = (
      studioId: string,
      date: string,
      start: number,
      end: number,
      excludeId?: ObjectId
    ) => {
      const filter: any = {
        studioId,
        date,
        status: "Confirmed",
        startHour: { $lt: end },
        endHour: { $gt: start },
      };
      if (excludeId) filter._id = { $ne: excludeId };
      return bookingsCollection.findOne(filter);
    };

    // Booking modal e dekhanor jonno: oi din e kon slot confirmed
    app.get("/bookings/availability", async (req, res) => {
      const { studioId, date } = req.query as Record<string, string>;
      if (!studioId || !date) {
        return res.status(400).json({ message: "studioId and date are required" });
      }
      const slots = await bookingsCollection
        .find({ studioId, date, status: "Confirmed" })
        .project({ startHour: 1, endHour: 1, _id: 0 })
        .toArray();
      res.json(slots);
    });

    app.post("/bookings", requireAuth, async (req, res) => {
      const { studioId, date, startHour, endHour, note } = req.body;
      const start = Number(startHour);
      const end = Number(endHour);

      if (!ObjectId.isValid(String(studioId)) || !date || Number.isNaN(start) || Number.isNaN(end)) {
        return res.status(400).json({ message: "Invalid booking data" });
      }
      if (start < 0 || end > 24 || end <= start) {
        return res.status(400).json({ message: "End time must be after the start time" });
      }

      const studio = await studiosCollection.findOne({ _id: new ObjectId(String(studioId)) });
      if (!studio) return res.status(404).json({ message: "Studio not found" });
      if (studio.ownerEmail === req.user!.email) {
        return res.status(400).json({ message: "You cannot book your own studio" });
      }

      // Challenge 2: Confirmed booking er sathe time overlap check
      const clash = await findConfirmedOverlap(String(studioId), date, start, end);
      if (clash) {
        return res.status(409).json({
          message: `This slot overlaps a confirmed booking (${clash.startHour}:00 to ${clash.endHour}:00). Please choose another time.`,
        });
      }

      const hours = end - start;
      const doc = {
        studioId: String(studioId),
        studioTitle: studio.title,
        studioImage: studio.image,
        hourlyRate: studio.hourlyRate,
        securityDeposit: studio.securityDeposit || 0,
        hostEmail: studio.ownerEmail,
        userEmail: req.user!.email,
        userName: req.user!.name,
        date,
        startHour: start,
        endHour: end,
        hours,
        totalPrice: hours * studio.hourlyRate + (studio.securityDeposit || 0),
        note: note || "",
        status: "Pending",
        createdAt: new Date(),
      };
      const result = await bookingsCollection.insertOne(doc);
      res.status(201).json({ insertedId: result.insertedId });
    });

    app.get("/bookings/my", requireAuth, async (req, res) => {
      const list = await bookingsCollection
        .find({ userEmail: req.user!.email })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(list);
    });

    // Booker nijer Pending booking cancel korte parbe
    app.patch("/bookings/:id/cancel", requireAuth, async (req, res) => {
      const id = String(req.params.id);
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid booking id" });
      }
      const _id = new ObjectId(id);
      const booking = await bookingsCollection.findOne({ _id });
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userEmail !== req.user!.email) {
        return res.status(403).json({ message: "This is not your booking" });
      }
      if (booking.status !== "Pending") {
        return res.status(400).json({ message: "Only pending bookings can be cancelled" });
      }
      await bookingsCollection.updateOne({ _id }, { $set: { status: "Cancelled" } });
      res.json({ message: "Booking cancelled" });
    });

    // Host er studio gulor shob booking
    app.get("/bookings/host", requireAuth, async (req, res) => {
      const list = await bookingsCollection
        .find({ hostEmail: req.user!.email })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(list);
    });

    // Host status bodlabe: Confirmed / Completed / Cancelled
    app.patch("/bookings/:id/status", requireAuth, async (req, res) => {
      const { status } = req.body;
      if (!["Confirmed", "Completed", "Cancelled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const id = String(req.params.id);
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid booking id" });
      }
      const _id = new ObjectId(id);
      const booking = await bookingsCollection.findOne({ _id });
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.hostEmail !== req.user!.email) {
        return res.status(403).json({ message: "Only the host can change this booking" });
      }

      if (status === "Confirmed") {
        const clash = await findConfirmedOverlap(
          booking.studioId,
          booking.date,
          booking.startHour,
          booking.endHour,
          _id
        );
        if (clash) {
          return res.status(409).json({ message: "Cannot confirm: this overlaps another confirmed booking" });
        }
      }
      await bookingsCollection.updateOne({ _id }, { $set: { status } });
      res.json({ message: `Booking ${status.toLowerCase()}` });
    });

    // ===== WISHLIST ROUTES =====

    app.get("/wishlist", requireAuth, async (req, res) => {
      const items = await wishlistCollection.find({ userEmail: req.user!.email }).toArray();
      res.json(items.map((i) => i.studioId));
    });

    // Toggle: save na thakle save, thakle remove
    app.post("/wishlist/:studioId", requireAuth, async (req, res) => {
      const filter = { userEmail: req.user!.email, studioId: String(req.params.studioId) };
      const existing = await wishlistCollection.findOne(filter);
      if (existing) {
        await wishlistCollection.deleteOne(filter);
        return res.json({ saved: false });
      }
      await wishlistCollection.insertOne({ ...filter, createdAt: new Date() });
      res.json({ saved: true });
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. Successfully connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}
run();

app.get("/", (_req, res) => {
  res.json({ message: "StudioSpace API is running" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});