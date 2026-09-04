import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Reservation, ReservationStatus } from '../reservations/reservation.entity';

@Injectable()
export class CheckoutService {
  constructor(private readonly dataSource: DataSource) {}

  async processCheckout(reservationId: number): Promise<Reservation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // قفل سجل الحجز للتأكد من عدم انتهاء صلاحيته أثناء معالجة الدفع
      const reservation = await queryRunner.manager.findOne(Reservation, {
        where: { id: reservationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!reservation) {
        throw new NotFoundException(`Reservation #${reservationId} not found`);
      }

      if (reservation.status === ReservationStatus.COMPLETED) {
        throw new BadRequestException('Reservation has already been checked out');
      }

      if (reservation.status === ReservationStatus.EXPIRED || new Date() > reservation.expiresAt) {
        throw new BadRequestException('Reservation has expired');
      }

      // إتمام عملية الشراء بنجاح
      reservation.status = ReservationStatus.COMPLETED;
      const saved = await queryRunner.manager.save(Reservation, reservation);

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}