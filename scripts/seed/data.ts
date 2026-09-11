// Fixed, realistic seed data. Every natural key here (email, restaurant
// name, event title, table number, promo code) is what the rest of the
// script uses to check "does this already exist?" before creating it —
// that's what makes re-running `pnpm seed` on an already-seeded database
// idempotent rather than duplicating everything.

export const SUPER_ADMIN = {
  email: "superadmin@ceylonevents.com",
  fullName: "Priyanka Wickramasinghe",
  password: "SuperAdmin!2024",
};

export interface RestaurantSeed {
  name: string;
  description: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  owner: { fullName: string; email: string };
  staff: { fullName: string; email: string }[];
  menu: { category: string; items: { name: string; description: string; priceMinorUnits: number; dietaryTags: string[] }[] }[];
}

export const RESTAURANTS: RestaurantSeed[] = [
  {
    name: "Spice Garden",
    description:
      "Contemporary Sri Lankan fine dining overlooking Galle Face Green, known for its Friday jazz nights and a kottu roti nobody can stop talking about.",
    address: "42 Galle Road, Colombo 03",
    contactEmail: "hello@spicegarden.lk",
    contactPhone: "+94 11 234 5678",
    owner: { fullName: "Dilani Fernando", email: "dilani.fernando@spicegarden.lk" },
    staff: [{ fullName: "Ruwan Perera", email: "ruwan.perera@spicegarden.lk" }],
    menu: [
      {
        category: "Mains",
        items: [
          { name: "Kottu Roti", description: "Chopped roti stir-fried with egg, chicken and house spices.", priceMinorUnits: 85000, dietaryTags: ["SPICY"] },
          { name: "Devilled Prawns", description: "Tiger prawns in a fiery tomato-chilli glaze.", priceMinorUnits: 145000, dietaryTags: ["SPICY"] },
          { name: "Jackfruit Curry", description: "Young jackfruit slow-cooked in coconut milk and roasted spices.", priceMinorUnits: 72000, dietaryTags: ["VEGAN", "SPICY"] },
        ],
      },
      {
        category: "Drinks",
        items: [
          { name: "King Coconut", description: "Chilled thambili, served straight from the shell.", priceMinorUnits: 35000, dietaryTags: ["VEGAN", "GLUTEN_FREE"] },
          { name: "Ceylon Iced Tea", description: "House-blended black tea over ice with a hint of lime.", priceMinorUnits: 42000, dietaryTags: ["VEGAN", "GLUTEN_FREE"] },
        ],
      },
    ],
  },
  {
    name: "Ocean Terrace",
    description:
      "Beachfront seafood grill in Negombo with an open-air deck, built for long dinners and live acoustic sets at sunset.",
    address: "17 Lewis Place, Negombo",
    contactEmail: "reservations@oceanterrace.lk",
    contactPhone: "+94 31 222 4491",
    owner: { fullName: "Nuwan Jayasuriya", email: "nuwan.jayasuriya@oceanterrace.lk" },
    staff: [{ fullName: "Ishara Gunasekara", email: "ishara.gunasekara@oceanterrace.lk" }],
    menu: [
      {
        category: "From the Grill",
        items: [
          { name: "Grilled Seer Fish", description: "Lime-marinated seer fish steak, char-grilled to order.", priceMinorUnits: 165000, dietaryTags: ["GLUTEN_FREE"] },
          { name: "Garlic Butter Prawns", description: "Jumbo prawns finished in garlic butter and curry leaves.", priceMinorUnits: 178000, dietaryTags: ["GLUTEN_FREE"] },
          { name: "Cashew Nut Curry", description: "Roasted cashews in a mild coconut curry.", priceMinorUnits: 68000, dietaryTags: ["VEG", "VEGAN", "GLUTEN_FREE"] },
        ],
      },
      {
        category: "Small Plates",
        items: [
          { name: "Isso Vadai", description: "Crisp lentil fritters topped with a whole prawn.", priceMinorUnits: 45000, dietaryTags: ["SPICY"] },
        ],
      },
    ],
  },
  {
    name: "Hill Country Kitchen",
    description:
      "A cosy tea-estate-inspired restaurant in Kandy serving highland classics, with a private dining room for small live sessions.",
    address: "8 Temple Road, Kandy",
    contactEmail: "info@hillcountrykitchen.lk",
    contactPhone: "+94 81 223 7765",
    owner: { fullName: "Chamari Rathnayake", email: "chamari.rathnayake@hillcountrykitchen.lk" },
    staff: [{ fullName: "Sampath Wijesinghe", email: "sampath.wijesinghe@hillcountrykitchen.lk" }],
    menu: [
      {
        category: "Rice & Curry",
        items: [
          { name: "Highland Rice & Curry", description: "Red rice with five rotating estate-grown vegetable curries.", priceMinorUnits: 62000, dietaryTags: ["VEG", "VEGAN"] },
          { name: "Black Pork Curry", description: "Kandyan-style pork slow-cooked with roasted black spices.", priceMinorUnits: 98000, dietaryTags: ["SPICY"] },
        ],
      },
      {
        category: "Desserts",
        items: [
          { name: "Watalappan", description: "Steamed coconut custard with jaggery and cardamom.", priceMinorUnits: 38000, dietaryTags: ["GLUTEN_FREE"] },
        ],
      },
    ],
  },
];

export const CUSTOMERS = [
  { fullName: "Amila Silva", email: "amila.silva@example.com" },
  { fullName: "Tharindu Bandara", email: "tharindu.bandara@example.com" },
  { fullName: "Kavindi Rajapaksa", email: "kavindi.rajapaksa@example.com" },
  { fullName: "Nadeesha Wickrama", email: "nadeesha.wickrama@example.com" },
  { fullName: "Chathura Herath", email: "chathura.herath@example.com" },
  { fullName: "Sanduni Gunawardena", email: "sanduni.gunawardena@example.com" },
  { fullName: "Lahiru Kodikara", email: "lahiru.kodikara@example.com" },
  { fullName: "Piumi Abeysekera", email: "piumi.abeysekera@example.com" },
];

export const SEED_PASSWORD = "CustomerPass!2024";
