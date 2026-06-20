const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const rows = [
    {
      name: "Ravi Kumar",
      company: "Alpha Traders",
      phoneNumber1: "+91-9876543210",
      phoneNumber2: "+91-9988776655",
      fullAddress: "12 Rashbehari Avenue, Near Gariahat, Kolkata - 700019",
      area: "Ballygunge",
      product: "Boom barrier",
      callType: "Service Visit",
    },
    {
      name: "Anita Sharma",
      company: "Sharma Foods",
      phoneNumber1: "+91-9123456780",
      phoneNumber2: null,
      fullAddress: "44 Salt Lake Sector 1, Kolkata - 700064",
      area: "Salt Lake",
      product: "Sliding gate",
      callType: "Installation",
    },
    {
      name: "Mohammed Irfan",
      company: "Irfan Electronics",
      phoneNumber1: "+91-9001122334",
      phoneNumber2: "+91-9556677889",
      fullAddress: "8 Park Circus Connector, Kolkata - 700017",
      area: "Park Circus",
      product: "Cctv",
      callType: "Complaint",
    },
  ];

  for (const row of rows) {
    const created = await prisma.serviceRequest.create({
      data: {
        docketNumber: "TEMP",
        ...row,
      },
    });

    await prisma.serviceRequest.update({
      where: { id: created.id },
      data: { docketNumber: `SRS-${created.id}` },
    });
  }

  console.log(`Inserted ${rows.length} dummy service records.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
