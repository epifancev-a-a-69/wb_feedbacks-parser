import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackModule } from './feedback/feedback.module';
import { AiModule } from './ai/ai.module';
import { FeedbackEntity } from './entities/feedback.entity';
import { AnalysisEntity } from './entities/analysis.entity';
import { DB_PASSWORD } from './config';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'postgres',
      port: 5432,
      username: 'postgres',
      password: DB_PASSWORD,
      database: 'wb_feedbacks',
      entities: [FeedbackEntity, AnalysisEntity],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([FeedbackEntity, AnalysisEntity]),
    FeedbackModule,
    AiModule,
  ],
})
export class AppModule {}