import type { CeylonEnv } from "../lib/env";
import { queryOne, sqlLiteral } from "../lib/db";
import type { Api } from "../lib/http";
import { uploadSeedImage } from "../lib/media";
import { RESTAURANTS } from "./data";
import { getRestaurantIdByName } from "./identity";
import type { SeededOwner } from "./identity";

export async function seedRestaurants(env: CeylonEnv, adminApi: Api): Promise<string[]> {
  const ids: string[] = [];
  for (const r of RESTAURANTS) {
    let id = await getRestaurantIdByName(r.name);
    if (!id) {
      const created = await adminApi.post("/restaurants", {
        name: r.name,
        description: r.description,
        address: r.address,
        contactEmail: r.contactEmail,
        contactPhone: r.contactPhone,
      });
      id = created.id;
      console.log(`  restaurants: created "${r.name}"`);
    }

    const status = await queryOne("restaurant_db", `SELECT status FROM restaurants WHERE id = ${sqlLiteral(id!)}`, [
      "status",
    ]);
    if (status?.status !== "APPROVED") {
      await adminApi.patch(`/restaurants/${id}/status`, { status: "APPROVED" });
      console.log(`  restaurants: approved "${r.name}"`);
    }

    ids.push(id!);
  }
  return ids;
}

/** Runs once each restaurant's owner account exists — cover photo,
 * categories, and priced menu items with their own uploaded photos. */
export async function seedMenus(
  env: CeylonEnv,
  restaurantIds: string[],
  owners: SeededOwner[],
): Promise<void> {
  for (let i = 0; i < RESTAURANTS.length; i++) {
    const r = RESTAURANTS[i];
    const restaurantId = restaurantIds[i];
    const owner = owners[i].api;

    const existingCover = await queryOne(
      "restaurant_db",
      `SELECT cover_photo_url FROM restaurants WHERE id = ${sqlLiteral(restaurantId)}`,
      ["cover_photo_url"],
    );
    if (!existingCover?.cover_photo_url) {
      const coverUrl = await uploadSeedImage(owner, "restaurant-cover", r.name);
      await owner.patch(`/restaurants/${restaurantId}`, { coverPhotoUrl: coverUrl });
      console.log(`  restaurants: uploaded cover photo for "${r.name}"`);
    }

    for (const category of r.menu) {
      let categoryId = (
        await queryOne(
          "restaurant_db",
          `SELECT id FROM menu_categories WHERE restaurant_id = ${sqlLiteral(restaurantId)} AND name = ${sqlLiteral(category.category)}`,
          ["id"],
        )
      )?.id;
      if (!categoryId) {
        const created = await owner.post(`/restaurants/${restaurantId}/menu-categories`, {
          name: category.category,
        });
        categoryId = created.id;
        console.log(`  restaurants: created menu category "${category.category}" for "${r.name}"`);
      }

      for (const item of category.items) {
        const existingItem = await queryOne(
          "restaurant_db",
          `SELECT id FROM menu_items WHERE category_id = ${sqlLiteral(categoryId!)} AND name = ${sqlLiteral(item.name)}`,
          ["id"],
        );
        if (existingItem?.id) continue; // already fully seeded, including its photo

        const photoUrl = await uploadSeedImage(owner, "menu-photo", `${r.name}-${item.name}`);
        await owner.post(`/restaurants/${restaurantId}/menu-items`, {
          categoryId,
          name: item.name,
          description: item.description,
          priceMinorUnits: item.priceMinorUnits,
          currency: "LKR",
          dietaryTags: item.dietaryTags,
          isAvailable: true,
          photoUrls: [photoUrl],
        });
        console.log(`  restaurants: created menu item "${item.name}" for "${r.name}"`);
      }
    }
  }
}
