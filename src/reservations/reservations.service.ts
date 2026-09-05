import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Reservation, ReservationStatus } from './reservation.entity';
import { Product } from '../products/product.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(private readonly dataSource: DataSource) {}

  async create(dto: CreateReservationDto): Promise<Reservation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. STOP Race Condition (SELECT ... FOR UPDATE)
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: dto.productId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) {
        throw new NotFoundException(`Product #${dto.productId} not found`);
      }

      if (product.stock < dto.quantity) {
        throw new BadRequestException('Not enough stock available');
      }

      // 2. quantity out of stock
      product.stock -= dto.quantity;
      await queryRunner.manager.save(Product, product);

      // 3. expiration 10min
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const reservation = queryRunner.manager.create(Reservation, {
        productId: product.id,
        quantity: dto.quantity,
        status: ReservationStatus.ACTIVE,
        expiresAt,
      });

      const savedReservation = await queryRunner.manager.save(
        Reservation,
        reservation,
      );

      await queryRunner.commitTransaction();
      return savedReservation;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findOne(id: number): Promise<Reservation> {
    const reservation = await this.dataSource.getRepository(Reservation).findOne({
      where: { id },
      relations: {
        product: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservation #${id} not found`);
    }

    return reservation;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredReservations() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const now = new Date();

      const expiredList = await queryRunner.manager
        .createQueryBuilder(Reservation, 'res')
        .setLock('pessimistic_write')
        .where('res.status = :status', { status: ReservationStatus.ACTIVE })
        .andWhere('res.expiresAt < :now', { now })
        .getMany();

      for (const res of expiredList) {
        res.status = ReservationStatus.EXPIRED;
        await queryRunner.manager.save(Reservation, res);

        await queryRunner.manager
          .createQueryBuilder()
          .update(Product)
          .set({ stock: () => `stock + ${res.quantity}` })
          .where('id = :id', { id: res.productId })
          .execute();
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error('Error expiring reservations:', err);
    } finally {
      await queryRunner.release();
    }
  }
}