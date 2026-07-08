export type ProductOption = {
  id: string;
  name: string;
};

export const SRTEC_PRODUCT_NAMES = [
  "Automatic Sliding Gate",
  "Automatic Swing Gate",
  "Automatic Retractable Gate",
  "Automatic Sliding Door",
  "Automatic Swing Door",
  "Revolving Door",
  "Automatic Rolling Door",
  "Boom Barrier",
  "Parking Fee Management System",
  "Parking Zone Display System",
  "Long Range RFID System",
  "Fastag Toll collection system",
  "Parking Blocker/ Tire Killer",
  "Road Blocker / Bollards",
  "Flap Barrier Gate",
  "Tripod / Turnstile",
  "Swing Barrier",
  "Full Height Turnstile",
  "CCTV System",
  "Biometric Attendance System",
  "Video Door Phone",
  "Remote Door Lock",
  "Intercom & EPABX",
  "Fire Alarm & Intrution Alarm",
  "Hand Metal Detector",
  "Smart WiFi Switch",
  "PVC Rapid Roll Up Door",
  "Manual Dock Edge",
  "Fire Rated Door",
  "Dock Leveler",
  "Cold Room Door",
  "Hermetically Sealed Door",
  "Self-Repairing Door",
  "PVC Speed Breaker",
  "Rubber Speed breaker",
  "Convex Mirror",
  "Que Manager",
  "Corner Guard",
  "Dock Bumper",
  "Expandable Barricade",
  "Safety Cone",
  "Spring Post",
  "Road Blocker",
  "Road Studs",
  "Traffic Light",
  "Wheel Stopper",
  "Fire Safety equipment",
] as const;

export function getProductOptions(databaseProducts: ProductOption[]) {
  const seen = new Set<string>();
  const options: ProductOption[] = [];

  const addProduct = (product: ProductOption) => {
    const key = product.name.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    options.push(product);
  };

  if (databaseProducts.length > 0) {
    databaseProducts.forEach(addProduct);
  } else {
    SRTEC_PRODUCT_NAMES.forEach((name, index) => {
      addProduct({ id: `srtec-${index}`, name });
    });
  }

  return options;
}
