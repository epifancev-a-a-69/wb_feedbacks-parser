// src/types/wb-feedback.types.ts

export interface WbPhoto {
  id: number;
  key: string;
  isBlurred: boolean;
  isReady: boolean;
}

export interface WbUserDetails {
  country: string;
  name: string;
  hasPhoto: boolean;
}

export interface WbAnswerMetadata {
  editText: string;
  editRejectReason: number;
}

export interface WbAnswer {
  text: string;
  state: string;
  lastUpdate: string | null;
  createDate: string;
  rejectReason: string | number | null;
  metadata: WbAnswerMetadata | null;
  editable?: boolean;
  employeeId?: number;
  supplierId?: number;
}

export interface WbFeedbackHelpfulness {
  globalUserId: string;
  wbUserId: number;
  helpfulness: 'plus' | 'minus';
  time: string;
}

export interface WbVotes {
  pluses: number;
  minuses: number;
}

export interface WbReason {
  good: number[];
  bad: number[];
}

export interface WbExcludedFromRating {
  isExcluded: boolean;
  reasons: string[];
}

export interface WbTag {
  id: number;
  status: 'plus' | 'minus';
}

export interface WbFeedback {
  id: string;                                    // Уникальный ID отзыва
  globalUserId: string;                          // ID пользователя (хеш)
  wbUserId: number;                              // ID пользователя WB
  wbUserDetails: WbUserDetails;                  // Детали пользователя
  nmId: number;                                  // ID номенклатуры (варианта товара)
  text: string;                                  // Текст отзыва
  pros: string;                                  // Плюсы (текст)
  cons: string;                                  // Минусы (текст)
  matchingSize: string;                          // Соответствие размеру
  matchingPhoto: string;                         // Соответствие фото
  matchingDescription: string;                   // Соответствие описанию
  productValuation: number;                      // Оценка товара (1-5)
  color: string;                                 // Цвет товара
  size: string;                                  // Размер
  createdDate: string;                           // Дата создания отзыва
  updatedDate: string;                           // Дата обновления
  answer: WbAnswer | null;                       // Ответ продавца
  feedbackHelpfulness: WbFeedbackHelpfulness[] | null; // Оценки полезности
  photos: WbPhoto[] | null;                      // Фото в отзыве
  photo: number[];                               // Массив ID фото
  video: any | null;                             // Видео (структура неясна)
  votes: WbVotes;                                // Голоса за/против
  rank: number;                                  // Ранг отзыва
  statusId: number;                              // Статус
  bables?: string[];                             // Ключевые слова (теги)
  reasons: WbReason;                             // Причины хорошего/плохого
  excludedFromRating: WbExcludedFromRating;      // Исключён из рейтинга
  tags?: WbTag[];                                // Теги отзыва
}

export interface NmValuationDistribution {
  nm: number;
  valuationDistribution: Record<string, number>;
  valuationDistributionPercent: Record<string, number>;
}

export interface WbFeedbackResponse {
  photosUris: string[];
  photo: number[];
  photos: WbPhoto[];
  valuation: string;                             // Средняя оценка (строка)
  valuationSum: number;                          // Сумма оценок
  valuationDistribution: Record<string, number>; // Распределение оценок (количество)
  valuationDistributionPercent: Record<string, number>; // Распределение в процентах
  nmValuationDistribution: NmValuationDistribution[]; // По номенклатурам
  matchingSizePercentages: any | null;
  feedbackCount: number;                         // Общее количество отзывов
  feedbackCountWithPhoto: number;                // С фото
  feedbackCountWithText: number;                 // С текстом
  feedbackCountWithVideo: number;                // С видео
  feedbacks: WbFeedback[];                       // Массив отзывов
}