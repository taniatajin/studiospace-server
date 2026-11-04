import "dotenv/config";
import { MongoClient } from "mongodb";

const gallery = (seed: string) => [1, 2, 3].map((n) => `https://picsum.photos/seed/${seed}-${n}/1200/800`);

const reviews = [
  { name: "Rina Ahmed", rating: 5, comment: "Spotless space and the gear was exactly as listed. Easy to book and easy to access.", date: "Oct 2026" },
  { name: "Jordan Blake", rating: 4, comment: "Great light and a very helpful host. Would book again for our next shoot.", date: "Sep 2026" },
  { name: "Sofia Marin", rating: 5, comment: "Perfect for our team session. Setup was quick and everything worked first time.", date: "Aug 2026" },
];

const amenitySets: Record<string, string[]> = {
  "Photo Studio": ["Cyclorama wall", "Profoto strobes", "Natural daylight", "Makeup station", "Free Wi-Fi", "Dressing room"],
  "Film Stage": ["Green screen", "Camlock power", "Acoustic blackbox", "Drive-in access", "Grip and lighting kit", "Green room"],
  "Podcast Lounge": ["Multi-cam 4K switcher", "Shure SM7B mics", "Sound treated walls", "Video monitor", "Free Wi-Fi", "Coffee bar"],
  "Music Suite": ["Dolby Atmos monitoring", "Analog console", "Vocal booth", "Live room", "Backline gear", "Lounge area"],
  Workshop: ["Ceramic kilns", "Pottery wheels", "Printmaking press", "Storage lockers", "Ventilation system", "Tools included"],
};

type Seed = [string, string, number, number, number, number, string, string, string, string, string];

const base: Seed[] = [
  ["Halo Cyclorama Photo Loft", "Photo Studio", 45, 100, 12, 4.9, "Brooklyn, New York", "studio-photo1", "Maya Collins", "maya@studiospace.com",
    "A bright loft with a 20 foot cyclorama wall, large north-facing windows and a full strobe kit. Ideal for fashion, product and portrait shoots."],
  ["Blackbox Cinema Sound Stage", "Film Stage", 120, 300, 40, 4.8, "Burbank, California", "studio-film1", "Daniel Ortiz", "daniel@studiospace.com",
    "A fully acoustic blackbox stage with green screen, camlock power and drive-in loading access. Built for short films and commercials."],
  ["Signal 4K Podcast Lounge", "Podcast Lounge", 35, 50, 6, 4.7, "Austin, Texas", "studio-podcast1", "Priya Nair", "priya@studiospace.com",
    "A turnkey podcast room with four broadcast mics, a three camera 4K switcher and a comfortable lounge set."],
  ["Atmos Analog Recording Suite", "Music Suite", 80, 150, 8, 5.0, "Nashville, Tennessee", "studio-music1", "Marcus Hill", "marcus@studiospace.com",
    "A professional recording suite with Dolby Atmos monitoring, an analog console and a tuned live room."],
  ["Kiln and Clay Maker Workshop", "Workshop", 28, 40, 10, 4.6, "Portland, Oregon", "studio-art1", "Elena Rossi", "elena@studiospace.com",
    "A shared maker workshop with pottery wheels, two kilns and a printmaking corner. Great for classes and content shoots."],
  ["Daylight Corner Photo Studio", "Photo Studio", 52, 120, 10, 4.8, "Chicago, Illinois", "studio-photo2", "Tom Becker", "tom@studiospace.com",
    "A corner studio with floor to ceiling windows, white and black backdrops and a rolling props wall."],
];

async function seed() {
  const client = new MongoClient(process.env.MONGODB_URI as string);
  await client.connect();
  const studios = client.db(process.env.DB_NAME).collection("studios");

  if ((await studios.countDocuments()) > 0) {
    console.log("Studios already exist, skipping seed.");
    await client.close();
    return;
  }

  const now = Date.now();
  const docs = base.map((s, i) => ({
    title: s[0],
    category: s[1],
    hourlyRate: s[2],
    securityDeposit: s[3],
    maxCapacity: s[4],
    rating: s[5],
    location: s[6],
    image: `https://picsum.photos/seed/${s[7]}/800/600`,
    gallery: gallery(s[7]),
    amenities: amenitySets[s[1]],
    overview: s[10],
    ownerName: s[8],
    ownerEmail: s[9],
    reviews,
    createdAt: new Date(now - i * 3600 * 1000),
  }));

  await studios.insertMany(docs);
  console.log(`Seeded ${docs.length} studios.`);
  await client.close();
}

seed();