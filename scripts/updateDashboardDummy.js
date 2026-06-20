const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const updates = [
    {
      fromArea: "Chennai Central",
      fromProduct: "Water Purifier X100",
      area: "Ballygunge",
      product: "Boom barrier",
      fullAddress: "12 Rashbehari Avenue, Near Gariahat, Kolkata - 700019",
    },
    {
      fromArea: "Coimbatore North",
      fromProduct: "Air Conditioner ProCool 1.5T",
      area: "Salt Lake",
      product: "Sliding gate",
      fullAddress: "44 Salt Lake Sector 1, Kolkata - 700064",
    },
    {
      fromArea: "Madurai East",
      fromProduct: "Refrigerator FrostFree 300L",
      area: "Park Circus",
      product: "Cctv",
      fullAddress: "8 Park Circus Connector, Kolkata - 700017",
    },
  ];

  let changed = 0;

  for (const update of updates) {
    const result = await prisma.serviceRequest.updateMany({
      where: {
        area: update.fromArea,
        product: update.fromProduct,
      },
      data: {
        area: update.area,
        product: update.product,
        fullAddress: update.fullAddress,
      },
    });

    changed += result.count;
  }

  console.log(`Updated ${changed} dashboard record(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
