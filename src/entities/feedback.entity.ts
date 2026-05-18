import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('feedbacks')
export class FeedbackEntity {
  @PrimaryColumn()
  id!: string;

  @Index()
  @Column()
  imtId!: string;

  @Column()
  userName!: string;

  @Column('text')
  text!: string;

  @Column('text', { nullable: true })
  pros!: string;

  @Column('text', { nullable: true })
  cons!: string;

  @Column('float')
  valuation!: number;

  @Column()
  createdDate!: Date;

  @Column({ default: false })
  hasText!: boolean;

  @CreateDateColumn()
  collectedAt!: Date;
}