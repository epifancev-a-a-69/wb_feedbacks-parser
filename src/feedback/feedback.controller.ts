// src/feedback/feedback.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { FeedbackService } from './feedback.service';

@Controller('feedbacks')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /**
   * GET /feedbacks/collect?imtId=123&periodDays=90
   * Реальное разбиение по датам
   */
  @Get('collect')
  async collectFeedbacks(
    @Query('imtId') imtId: string,
    @Query('periodDays') periodDays?: string,
  ) {
    const days = periodDays ? parseInt(periodDays, 10) : 90;

    if (!imtId) {
      return {
        success: false,
        error: 'Не указан imtId',
        example: '/feedbacks/collect?imtId=176034565&periodDays=90',
      };
    }

    if (isNaN(days) || days < 1 || days > 3650) {
      return {
        success: false,
        error: 'periodDays должен быть числом от 1 до 3650',
      };
    }

    try {
      const result = await this.feedbackService.getSplitFeedbacks(imtId, days);
      return { success: true, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка при получении отзывов';
      return { success: false, error: message };
    }
  }

  /**
   * GET /feedbacks/demo?imtId=123&periodDays=90&splitRatio=0.3
   * Демонстрационное разбиение (искусственное)
   */
  @Get('demo')
  async demoFeedbacks(
    @Query('imtId') imtId: string,
    @Query('periodDays') periodDays?: string,
    @Query('splitRatio') splitRatio?: string,
  ) {
    const days = periodDays ? parseInt(periodDays, 10) : 90;
    const ratio = splitRatio ? parseFloat(splitRatio) : 0.3;

    if (!imtId) {
      return {
        success: false,
        error: 'Не указан imtId',
        example: '/feedbacks/demo?imtId=176034565&periodDays=90&splitRatio=0.3',
      };
    }

    if (isNaN(days) || days < 1 || days > 3650) {
      return {
        success: false,
        error: 'periodDays должен быть числом от 1 до 3650',
      };
    }

    if (isNaN(ratio) || ratio < 0.1 || ratio > 0.5) {
      return {
        success: false,
        error: 'splitRatio должен быть от 0.1 до 0.5 (10-50% старых)',
      };
    }

    try {
      const result = await this.feedbackService.getDemoSplitFeedbacks(imtId, days, ratio);
      return { success: true, demo: true, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка при получении отзывов';
      return { success: false, error: message };
    }
  }

  /**
   * GET /feedbacks/stats?imtId=123
   * Только статистика
   */
  @Get('stats')
  async getStats(@Query('imtId') imtId: string) {
    if (!imtId) {
      return { success: false, error: 'Не указан imtId' };
    }

    try {
      const result = await this.feedbackService.getSplitFeedbacks(imtId, 90);
      return {
        success: true,
        imtId: result.imtId,
        actualReceived: result.actualReceived,
        totalCount: result.totalCount,
        dateRange: result.dateRange,
        stats: result.stats,
        periodDays: result.periodDays,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка';
      return { success: false, error: message };
    }
  }

  /**
   * GET /feedbacks/summary?imtId=123&periodDays=90
   * AI-сводка по старым и новым отзывам + сравнение
   */
  @Get('summary')
async getSummary(
    @Query('imtId') imtId: string,
    @Query('periodDays') periodDays?: string,
  ) {
    const days = periodDays ? parseInt(periodDays, 10) : 90;

    if (!imtId) {
      return { success: false, error: 'Не указан imtId' };
    }

    try {
      const result = await this.feedbackService.getFeedbackSummary(imtId, days);
      return { success: true, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка';
      return { success: false, error: message };
    }
  }
}
