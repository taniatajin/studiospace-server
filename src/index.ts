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

    // ===== BOOKINGS ROUTES =====

    // ===== WISHLIST ROUTES =====

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