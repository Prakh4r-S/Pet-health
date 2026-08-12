import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("No database URL set");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// ---------------------------------------------------------------
// Reference data.
//
// The vaccine intervals below are plausible defaults for a demo,
// not veterinary guidance. Real schedules vary by region, local law
// (rabies in particular), manufacturer, and the animal's age at first
// dose. Before this becomes anything more than a prototype, the whole
// table needs replacing with vet-reviewed data for your jurisdiction.
// ---------------------------------------------------------------

const data = [
  {
    name: "Dog",
    slug: "dog",
    careNotes:
      "Daily exercise, dental care from an early age, annual health check. Weight gain is the most common preventable problem.",
    breeds: [
      { name: "Indian Pariah Dog", slug: "indian-pariah", min: 15, max: 30, lifespan: 14 },
      { name: "Labrador Retriever", slug: "labrador-retriever", min: 25, max: 36, lifespan: 12 },
      { name: "German Shepherd", slug: "german-shepherd", min: 22, max: 40, lifespan: 11 },
      { name: "Golden Retriever", slug: "golden-retriever", min: 25, max: 34, lifespan: 11 },
      { name: "Beagle", slug: "beagle", min: 9, max: 11, lifespan: 13 },
      { name: "Pug", slug: "pug", min: 6, max: 8, lifespan: 13 },
      { name: "Shih Tzu", slug: "shih-tzu", min: 4, max: 7, lifespan: 13 },
      { name: "Rottweiler", slug: "rottweiler", min: 35, max: 60, lifespan: 9 },
      { name: "Dachshund", slug: "dachshund", min: 7, max: 15, lifespan: 14 },
    ],
    vaccines: [
      { name: "Rabies", slug: "rabies", core: true, months: 12 },
      { name: "DHPP", slug: "dhpp", core: true, months: 12 },
      { name: "Leptospirosis", slug: "leptospirosis", core: false, months: 12 },
      { name: "Bordetella", slug: "bordetella", core: false, months: 12 },
      { name: "Canine Coronavirus", slug: "canine-coronavirus", core: false, months: 12 },
    ],
  },
  {
    name: "Cat",
    slug: "cat",
    careNotes:
      "Indoor cats need environmental enrichment. Watch water intake and litter habits — changes there are often the first sign of urinary or kidney trouble.",
    breeds: [
      { name: "Domestic Shorthair", slug: "domestic-shorthair", min: 3.5, max: 5.5, lifespan: 15 },
      { name: "Persian", slug: "persian", min: 3, max: 5.5, lifespan: 14 },
      { name: "Siamese", slug: "siamese", min: 2.5, max: 5, lifespan: 15 },
      { name: "Maine Coon", slug: "maine-coon", min: 5, max: 10, lifespan: 13 },
      { name: "Bengal", slug: "bengal", min: 4, max: 7, lifespan: 14 },
    ],
    vaccines: [
      { name: "Rabies", slug: "rabies", core: true, months: 12 },
      { name: "FVRCP", slug: "fvrcp", core: true, months: 12 },
      { name: "Feline Leukaemia (FeLV)", slug: "felv", core: false, months: 12 },
    ],
  },
  {
    name: "Rabbit",
    slug: "rabbit",
    careNotes:
      "Unlimited hay is the foundation of the diet. Teeth grow continuously; reduced appetite is an emergency, not a wait-and-see.",
    breeds: [
      { name: "Netherland Dwarf", slug: "netherland-dwarf", min: 0.7, max: 1.1, lifespan: 10 },
      { name: "Lionhead", slug: "lionhead", min: 1.3, max: 1.7, lifespan: 9 },
      { name: "New Zealand White", slug: "new-zealand-white", min: 4, max: 5.5, lifespan: 8 },
    ],
    vaccines: [
      { name: "Myxomatosis", slug: "myxomatosis", core: true, months: 12 },
      { name: "RHDV", slug: "rhdv", core: true, months: 12 },
    ],
  },
];

async function main() {
  for (const s of data) {
    const species = await prisma.species.upsert({
      where: { slug: s.slug },
      update: { name: s.name, careNotes: s.careNotes },
      create: { name: s.name, slug: s.slug, careNotes: s.careNotes },
    });

    for (const b of s.breeds) {
      await prisma.breed.upsert({
        where: { speciesId_slug: { speciesId: species.id, slug: b.slug } },
        update: {},
        create: {
          speciesId: species.id,
          name: b.name,
          slug: b.slug,
          adultWeightMinKg: b.min,
          adultWeightMaxKg: b.max,
          typicalLifespanYears: b.lifespan,
        },
      });
    }

    for (const v of s.vaccines) {
      await prisma.vaccineType.upsert({
        where: { speciesId_slug: { speciesId: species.id, slug: v.slug } },
        update: {},
        create: {
          speciesId: species.id,
          name: v.name,
          slug: v.slug,
          isCore: v.core,
          defaultIntervalMonths: v.months,
        },
      });
    }

    console.log(`seeded ${s.name}: ${s.breeds.length} breeds, ${s.vaccines.length} vaccines`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());