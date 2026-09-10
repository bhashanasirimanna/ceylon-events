import { Injectable } from "@nestjs/common";
import type { FoodPreOrderSnapshot } from "@ceylon/shared-types";
import { Observable, Subject, filter, map } from "rxjs";

interface ChangeEvent {
  eventId: string;
  foodPreOrder: FoodPreOrderSnapshot;
}

// In-memory pub/sub, scoped to this single service instance — adequate
// for one replica (this build's whole stack runs as one instance per
// service). Scaling food-order-service horizontally would need this
// backed by Redis pub/sub (already running in this stack for the seat
// hold-locks) instead; noted here rather than built now since it isn't
// needed yet.
@Injectable()
export class FoodOrdersRealtimeService {
  private readonly changes$ = new Subject<ChangeEvent>();

  publish(eventId: string, foodPreOrder: FoodPreOrderSnapshot): void {
    this.changes$.next({ eventId, foodPreOrder });
  }

  streamForEvent(eventId: string): Observable<FoodPreOrderSnapshot> {
    return this.changes$.pipe(
      filter((change) => change.eventId === eventId),
      map((change) => change.foodPreOrder),
    );
  }
}
