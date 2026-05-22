// src/entities/alanysis.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('analyses')
export class AnalysisEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  imtId!: string;

  @Column()
  periodDays!: number;

  @Column('jsonb')
  data!: any;

  @CreateDateColumn()
  createdAt!: Date;
}