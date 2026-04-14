import { firestore } from '../config/firebase';
import { User, UserCreateInput, UserUpdateInput } from '../models/user.model';

export class UsersRepository {
  private readonly collection = firestore.collection('users');

  async list(): Promise<User[]> {
    const snapshot = await this.collection.orderBy('createdAt', 'desc').get();

    return snapshot.docs.map((doc) => {
      const data = doc.data() as Omit<User, 'id'>;
      return {
        id: doc.id,
        ...data,
      };
    });
  }

  async getById(id: string): Promise<User | null> {
    const doc = await this.collection.doc(id).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as Omit<User, 'id'>;
    return {
      id: doc.id,
      ...data,
    };
  }

  async create(payload: UserCreateInput): Promise<User> {
    const createdAt = new Date().toISOString();
    const docRef = await this.collection.add({
      email: payload.email,
      name: payload.name,
      role: payload.role ?? 'user',
      createdAt,
    });

    return {
      id: docRef.id,
      email: payload.email,
      name: payload.name,
      role: payload.role ?? 'user',
      createdAt,
    };
  }

  async update(id: string, payload: UserUpdateInput): Promise<User | null> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    await docRef.update(payload as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>);

    const updated = await docRef.get();
    const data = updated.data() as Omit<User, 'id'>;

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
