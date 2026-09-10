"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Badge } from "@ceylon/design-system";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Nav } from "@/components/Nav";

const DIETARY_TAGS = ["VEG", "VEGAN", "GLUTEN_FREE", "SPICY"] as const;

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceMinorUnits: number;
  currency: string;
  dietaryTags: string[];
  isAvailable: boolean;
}

interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  items: MenuItem[];
}

function formatPrice(minorUnits: number, currency: string) {
  return `${currency} ${(minorUnits / 100).toFixed(2)}`;
}

export default function MenuPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMenu, setLoadingMenu] = useState(true);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySort, setNewCategorySort] = useState(0);
  const [addingCategory, setAddingCategory] = useState(false);

  const [itemForms, setItemForms] = useState<
    Record<
      string,
      {
        name: string;
        description: string;
        price: string;
        currency: string;
        dietaryTags: string[];
      }
    >
  >({});

  const loadMenu = useCallback(async (restaurantId: string) => {
    setLoadingMenu(true);
    try {
      const data = await apiFetch<MenuCategory[]>(
        `/restaurants/${restaurantId}/menu`,
      );
      setCategories(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load menu");
    } finally {
      setLoadingMenu(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.restaurantId) {
      loadMenu(user.restaurantId);
    }
  }, [isLoading, user, router, loadMenu]);

  if (isLoading || !user || !user.restaurantId) {
    return <main className="p-6 text-sm text-neutral-500">Loading...</main>;
  }

  const restaurantId = user.restaurantId;

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    setAddingCategory(true);
    setError(null);
    try {
      await apiFetch(`/restaurants/${restaurantId}/menu-categories`, {
        method: "POST",
        body: JSON.stringify({
          name: newCategoryName,
          sortOrder: newCategorySort,
        }),
      });
      setNewCategoryName("");
      setNewCategorySort(0);
      await loadMenu(restaurantId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add category");
    } finally {
      setAddingCategory(false);
    }
  }

  function getItemForm(categoryId: string) {
    return (
      itemForms[categoryId] ?? {
        name: "",
        description: "",
        price: "",
        currency: "LKR",
        dietaryTags: [],
      }
    );
  }

  function updateItemForm(
    categoryId: string,
    patch: Partial<ReturnType<typeof getItemForm>>,
  ) {
    setItemForms((prev) => ({
      ...prev,
      [categoryId]: { ...getItemForm(categoryId), ...patch },
    }));
  }

  function toggleDietaryTag(categoryId: string, tag: string) {
    const form = getItemForm(categoryId);
    const has = form.dietaryTags.includes(tag);
    updateItemForm(categoryId, {
      dietaryTags: has
        ? form.dietaryTags.filter((t) => t !== tag)
        : [...form.dietaryTags, tag],
    });
  }

  async function handleAddItem(categoryId: string, e: React.FormEvent) {
    e.preventDefault();
    const form = getItemForm(categoryId);
    const priceValue = Number.parseFloat(form.price);
    if (Number.isNaN(priceValue) || priceValue < 0) {
      setError("Enter a valid price");
      return;
    }
    setError(null);
    try {
      await apiFetch(`/restaurants/${restaurantId}/menu-items`, {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name: form.name,
          description: form.description || undefined,
          priceMinorUnits: Math.round(priceValue * 100),
          currency: form.currency,
          dietaryTags: form.dietaryTags,
          isAvailable: true,
        }),
      });
      setItemForms((prev) => ({ ...prev, [categoryId]: getItemForm("") }));
      await loadMenu(restaurantId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add item");
    }
  }

  async function toggleAvailability(item: MenuItem) {
    setError(null);
    try {
      await apiFetch(`/menu-items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      await loadMenu(restaurantId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update item");
    }
  }

  async function deleteItem(item: MenuItem) {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/menu-items/${item.id}`, { method: "DELETE" });
      await loadMenu(restaurantId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete item");
    }
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">
          Menu Management
        </h1>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="mb-8 flex flex-col gap-6">
          {loadingMenu && (
            <p className="text-sm text-neutral-500">Loading menu...</p>
          )}
          {!loadingMenu && categories.length === 0 && (
            <p className="text-sm text-neutral-500">
              No categories yet — add your first one below.
            </p>
          )}
          {categories.map((category) => {
            const form = getItemForm(category.id);
            return (
              <Card key={category.id}>
                <h2 className="mb-3 text-lg font-medium text-neutral-900">
                  {category.name}
                </h2>
                <ul className="mb-4 flex flex-col gap-2">
                  {category.items.length === 0 && (
                    <li className="text-sm text-neutral-400">
                      No items in this category yet.
                    </li>
                  )}
                  {category.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-md border border-neutral-100 px-3 py-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-neutral-900">
                            {item.name}
                          </span>
                          <span className="text-sm text-neutral-500">
                            {formatPrice(item.priceMinorUnits, item.currency)}
                          </span>
                          <Badge tone={item.isAvailable ? "success" : "neutral"}>
                            {item.isAvailable ? "Available" : "Unavailable"}
                          </Badge>
                        </div>
                        {item.description && (
                          <p className="text-sm text-neutral-500">
                            {item.description}
                          </p>
                        )}
                        {item.dietaryTags.length > 0 && (
                          <div className="mt-1 flex gap-1">
                            {item.dietaryTags.map((tag) => (
                              <Badge key={tag} tone="neutral">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => toggleAvailability(item)}
                        >
                          {item.isAvailable ? "Mark unavailable" : "Mark available"}
                        </Button>
                        <Button variant="danger" onClick={() => deleteItem(item)}>
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>

                <form
                  onSubmit={(e) => handleAddItem(category.id, e)}
                  className="flex flex-wrap items-end gap-3 border-t border-neutral-100 pt-3"
                >
                  <div className="flex flex-col">
                    <label className="text-xs text-neutral-500">Name</label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) =>
                        updateItemForm(category.id, { name: e.target.value })
                      }
                      className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs text-neutral-500">
                      Description
                    </label>
                    <input
                      value={form.description}
                      onChange={(e) =>
                        updateItemForm(category.id, {
                          description: e.target.value,
                        })
                      }
                      className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs text-neutral-500">
                      Price ({form.currency})
                    </label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) =>
                        updateItemForm(category.id, { price: e.target.value })
                      }
                      className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-neutral-500">
                      Dietary tags
                    </span>
                    <div className="flex gap-2">
                      {DIETARY_TAGS.map((tag) => (
                        <label
                          key={tag}
                          className="flex items-center gap-1 text-xs text-neutral-600"
                        >
                          <input
                            type="checkbox"
                            checked={form.dietaryTags.includes(tag)}
                            onChange={() => toggleDietaryTag(category.id, tag)}
                          />
                          {tag}
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button type="submit">+ Add item</Button>
                </form>
              </Card>
            );
          })}
        </div>

        <Card>
          <h2 className="mb-3 text-lg font-medium text-neutral-900">
            + Add category
          </h2>
          <form
            onSubmit={handleAddCategory}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col">
              <label className="text-xs text-neutral-500">Name</label>
              <input
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-neutral-500">Sort order</label>
              <input
                type="number"
                min="0"
                value={newCategorySort}
                onChange={(e) => setNewCategorySort(Number(e.target.value))}
                className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
            </div>
            <Button type="submit" disabled={addingCategory}>
              {addingCategory ? "Adding..." : "Add category"}
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}
