import { Controller, Post, Param, ParseIntPipe } from '@nestjs/common';
import { CheckoutService } from './checkout.service';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post(':reservationId')
  checkout(@Param('reservationId', ParseIntPipe) reservationId: number) {
    return this.checkoutService.processCheckout(reservationId);
  }
}