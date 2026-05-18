// src/app.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { WildberriesClient } from './wildberries-client';

@Controller('feedbacks')
export class AppController {
  getHello(): any {
    throw new Error('Method not implemented.');
  }
  constructor(private readonly wbClient: WildberriesClient) {}

  @Get('collect')
  async collectFeedbacks(@Query('imtId') imtId: string) {
    const data = await this.wbClient.fetchFeedbacks(imtId);
    return {
      success: true,
      totalCount: data.feedbackCount,
      feedbacks: data.feedbacks.slice(0, 10), // первые 10 для демо
    };
  }
}