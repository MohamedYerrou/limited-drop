import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ProductsModule } from './products/products.module';
import { Product } from './products/product.entity';
import { ReservationsModule } from './reservations/reservations.module';
import { Reservation } from './reservations/reservation.entity';
import { CheckoutModule } from './checkout/checkout.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [Product, Reservation],
        synchronize: true,
        ssl: {
          rejectUnauthorized: false,
        },
      }),
    }),
    ProductsModule,
    ReservationsModule,
    CheckoutModule,
  ],
})
export class AppModule {}