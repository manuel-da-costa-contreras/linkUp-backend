import { firestore } from '../config/firebase';
import { Order, OrderCreateInput, OrderUpdateInput } from '../models/order.model';

export class OrdersRepository {
  private readonly collection = firestore.collection('orders');

  async list(): Promise<Order[]> {
    const snapshot = await this.collection.orderBy('createdAt', 'desc').get();

    return snapshot.docs.map((doc) => {
      const data = doc.data() as Omit<Order, 'id'>;
      return {
        id: doc.id,
        ...data,
      };
    });
  }

  async getById(id: string): Promise<Order | null> {
    const doc = await this.collection.doc(id).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as Omit<Order, 'id'>;
    return {
      id: doc.id,
      ...data,
    };
  }

  async create(payload: OrderCreateInput): Promise<Order> {
    const createdAt = new Date().toISOString();
    const order: Omit<Order, 'id'> = {
      userId: payload.userId,
      status: payload.status ?? 'pending',
      total: payload.total,
      createdAt,
    };

    const docRef = await this.collection.add(order);

    return {
      id: docRef.id,
      ...order,
    };
  }

  async update(id: string, payload: OrderUpdateInput): Promise<Order | null> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    await docRef.update(payload as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>);

    const updated = await docRef.get();
    const data = updated.data() as Omit<Order, 'id'>;

    return {
      id: updated.id,
      ...data,
    };
  }

  async remove(id: string): Promise<boolean> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return false;
    }

    await docRef.delete();
    return true;
  }
}
