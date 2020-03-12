import {Entity, Column, PrimaryColumn} from 'typeorm';

@Entity('account')
export class Account {
    @PrimaryColumn('int', {
        unique: true,
        nullable: false,
    })
    accountid!: number;

    @Column({
        type: 'date',
    })
    createdateutc!: Date;

    @Column({
        type: 'date',
        nullable: true,
    })
    enddateutc!: Date;

    @Column({
        type: 'date',
        nullable: true,
    })
    lastcheckdateutc!: Date;

    @Column('int', {
        nullable: true,
    })
    timezone!: number;

    @Column({
        nullable: true,
    })
    tariffname!: string;

    @Column('int', {
        nullable: true,
    })
    tariffid!: number;

    @Column('int', {
        nullable: true,
    })
    usercount!: number;

    @Column({
        nullable: true,
    })
    havepartner!: boolean;

    @Column('int', {
        nullable: true,
    })
    lastleadid!: number;
}