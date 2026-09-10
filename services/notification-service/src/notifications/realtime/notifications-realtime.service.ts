import { Injectable } from "@nestjs/common";
import type { NotificationSnapshot } from "@ceylon/shared-types";
import { Observable, Subject, filter, map } from "rxjs";

interface ChangeEvent {
  userId: string;
  notification: NotificationSnapshot;
}

// In-memory pub/sub, scoped to this single service instance — same
// accepted limitation as FoodOrdersRealtimeService (see that service for
// the reasoning): fine for one replica, would need Redis pub/sub to scale
// horizontally.
@Injectable()
export class NotificationsRealtimeService {
  private readonly changes$ = new Subject<ChangeEvent>();

  publish(userId: string, notification: NotificationSnapshot): void {
    this.changes$.next({ userId, notification });
  }

  streamForUser(userId: string): Observable<NotificationSnapshot> {
    return this.changes$.pipe(
      filter((change) => change.userId === userId),
      map((change) => change.notification),
    );
  }
}
