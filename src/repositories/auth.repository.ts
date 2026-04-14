import { firestore } from '../config/firebase';

export class AuthRepository {
  private readonly collection = firestore.collection('auth_sessions');

  async health(): Promise<string> {
    return `Repository ready: ${this.collection.id}`;
  }
}
