import "dotenv/config";
import { MongoClient } from "mongodb";

// Prottek studio er chhobi client er public/images folder theke ashbe
const images: Record<string, string> = {
  "Halo Cyclorama Photo Loft": "/images/photo-loft.jpg",
  "Blackbox Cinema Sound Stage": "/images/film-stage.jpg",
  "Signal 4K Podcast Lounge": "/images/podcast-lounge.jpg",
  "Atmos Analog Recording Suite": "/images/music-suite.jpg",
  "Kiln and Clay Maker Workshop": "/images/art-workshop.jpg",
  "Daylight Corner Photo Studio": "/images/corner-studio.jpg",
};

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI as string);
  await client.connect();
  const studios = client.db(process.env.DB_NAME).collection("studios");

  for (const [title, path] of Object.entries(images)) {
    const result = await studios.updateOne({ title }, { $set: { image: path, gallery: [path] } });
    console.log(`${title}: ${result.matchedCount ? "updated" : "not found"}`);
  }

  await client.close();
}

main();