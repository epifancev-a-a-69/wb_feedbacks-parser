// src/ai/ai.module.ts
import { Module, Global } from '@nestjs/common';
import { AiService } from './ai.service';

@Global() // Делаем AiService доступным везде без импорта AiModule
@Module({
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}