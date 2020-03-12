import {Entity, PrimaryGeneratedColumn, Column} from 'typeorm';

@Entity('task')
export class Task {
    @PrimaryGeneratedColumn()
    id: number | undefined;
    @Column({type: 'int', nullable: true})
    crmaccountid: number | undefined;
    @Column({type: 'int', nullable: true})
    event: number | undefined;
    @Column({type: 'date', nullable: true})
    createdateutc: Date | undefined;
    @Column({type: 'date', nullable: true})
    processeddateutc: Date | undefined;
    @Column({type: 'date', nullable: true})
    nexttrydateutc: Date | undefined;
    @Column({type: 'int', nullable: true})
    attemptcount: number | undefined;
    @Column({type: 'boolean', nullable: true})
    isprocessing: boolean | undefined;
}
