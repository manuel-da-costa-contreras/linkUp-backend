import { Order, OrderCreateInput, OrderUpdateInput } from '../models/order.model';
import { OrdersRepository } from '../repositories/orders.repository';
import { HttpError } from '../utils/httpError';

export class OrdersService {
  constructor(private readonly ordersRepository: OrdersRepository = new OrdersRepository()) {}

  async list(): Promise<Order[]> {
    return this.ordersRepository.list();
  }

  async getById(id: string): Promise<Order> {
    const order = await this.ordersRepository.getById(id);

    if (!order) {
      throw new HttpError(404, 'Order not found');
    }

    return order;
  }

  async create(payload: OrderCreateInput): Promise<Order> {
    this.validateCreate(payload);
    return this.ordersRepository.create(payload);
  }

  async update(id: string, payload: OrderUpdateInput): Promise<Order> {
    this.validateUpdate(payload);

    const order = await this.ordersRepository.update(id, payload);

    if (!order) {
      throw new HttpError(404, 'Order not found');
    }

    return order;
  }

  async remove(id: string): Promise<void> {
    const removed = await this.ordersRepository.remove(id);

    if (!removed) {
      throw new HttpError(404, 'Order not found');
    }
  }

  private validateCreate(payload: OrderCreateInput): void {
    if (!payload.userId || payload.userId.trim().length === 0) {
      throw new HttpError(400, 'userId is required');
    }

    if (typeof payload.total !== 'number' || Number.isNaN(payload.total) || payload.total < 0) {
      throw new HttpError(400, 'total must be a number greater than or equal to 0');
    }

    if (payload.status && !['pending', 'paid', 'cancelled'].includes(payload.status)) {
      throw new HttpError(400, 'status must be pending, paid or cancelled');
    }
  }

  private validateUpdate(payload: OrderUpdateInput): void {
    if (Object.keys(payload).length === 0) {
      throw new HttpError(400, 'At least one field is required to update');
    }

    if (payload.userId !== undefined && payload.userId.trim().length === 0) {
      throw new HttpError(400, 'userId cannot be empty');
    }

    if (
      payload.total !== undefined &&
      (typeof payload.total !== 'number' || Number.isNaN(payload.total) || payload.total < 0)
    ) {
      throw new HttpError(400, 'total must be a number greater than or equal to 0');
    }

    if (payload.status !== undefined && !['pending', 'paid', 'cancelled'].includes(payload.status)) {
      throw new HttpError(400, 'status must be pending, paid or cancelled');
    }
  }
}
