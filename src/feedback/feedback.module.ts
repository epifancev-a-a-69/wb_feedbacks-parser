import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { WildberriesClient } from '../wildberries-client';
import { AiService } from '../ai/ai.service';
import { FeedbackEntity } from '../entities/feedback.entity';
import { AnalysisEntity } from '../entities/analysis.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FeedbackEntity, AnalysisEntity])],
  controllers: [FeedbackController],
  providers: [FeedbackService, WildberriesClient, AiService],
  exports: [FeedbackService],
})
export class FeedbackModule {}