import { log } from 'console';
import * as moment from 'moment';
import * as business from 'moment-business';
import { createConnection } from 'typeorm';
import { Account } from '../entity/Account';
import { Lead } from '../interface/lead';
import * as consts from '../utils/const';
import { Task } from './../entity/Task';
const AmoCRM = require('amocrm-js');
// tslint:disable-next-line: no-var-requires
const momentCtr: any = moment.fn;
if (typeof momentCtr.inspect === 'function') {
    momentCtr[Symbol.for('nodejs.util.inspect.custom')] = momentCtr.inspect;
} else {
    console.error('Unablet to set moment inspector');
}

class Worker {

    public async GetOneFromTaskBd(): Promise<Task & Account> {
        return new Promise((resolve, reject) => {
            createConnection({
                type: consts.cnType,
                host: consts.cnHost,
                port: consts.cnPort,
                username: consts.cnUsername,
                password: consts.cnPassword,
                database: consts.cnDatabase,
                entities: [
                    Account, Task,
                ],
                synchronize: false,
                logging: false,
            }).then(async connection => {
                await connection.manager.query(`UPDATE public.task SET processeddateutc = Current_Date where attemptcount > 9 and processeddateutc is null`);
                const getTask: Task[] = await connection.manager.query(consts.queryToBdTaskGetOne);
                // test get-task
                // const getTask: Task[] = await connection.manager.query(`select * from public.task where id = 21217`);
                const editTask = getTask[0];
                // log(editTask);
                if (editTask.id) {
                    await connection.manager.query(`update task set isprocessing = true where id = ${editTask.id}`);
                    log('task set isprocessing = true');
                }
                const getAccount: Account[] = await connection.manager.query(`select * from public.account where accountid = ${editTask.crmaccountid}`);
                // получение данных из тестового аккаунта, для прода ниже закоментить, выше раскоментить
                // const getAccount: Account[] = await connection.manager.query(`select * from public.account where accountid = 17892940`);
                const editAccount = getAccount[0];
                // log(editAccount);
                const merged = this.mergeObject(editTask, editAccount);
                connection.close();
                return resolve(merged);
            }).catch((error: any) => {
                log(error);
                throw new Error(error);
            });
        });
    }

    public async FindLead(taskAndAccount: Task & Account): Promise<Lead> {
        return new Promise((resolve, reject) => {
            const crm = new AmoCRM({
                domain: consts.amoSettings.domain,
                auth: {
                    login: consts.amoSettings.login,
                    hash: consts.amoSettings.hash,
                },
            });
            const accountId = taskAndAccount.crmaccountid;
            // const accountId = '10338573'; // тестовые данные
            crm.connect()
                .then(() => {
                    crm.request.get(`/api/v2/leads?query=${accountId}`)
                        .then((data: any) => {
                            // log( 'Полученные данные', data );
                            if (data._embedded !== undefined) {
                                const res = data._embedded.items[0];
                                return resolve(res);
                            } else {
                                crm.request.get(`/api/v2/leads?id=${taskAndAccount.lastleadid}`)
                                    .then((dataLead: any) => {
                                        // log('dataLead._embedded = ', dataLead._embedded);
                                        if (dataLead._embedded !== undefined) {
                                            const res = dataLead._embedded.items[0];
                                            return resolve(res);
                                        } else {
                                            throw Error('not find lead');
                                        }
                                    })
                                    .catch((err: any) => {
                                        log('Произошла ошибка', err);
                                        this.isprocessingTaskFalse(taskAndAccount, 'error');
                                        return reject;
                                    })
                            }
                        })
                        .catch((err: any) => {
                            log('Произошла ошибка', err);
                            this.isprocessingTaskFalse(taskAndAccount, 'error');
                            return reject;
                        })
                })
                .catch((err: any) => {
                    log('Ошибка входа', err);
                    crm.disconnect();
                });
        });
    }

    public async UpdateLead(taskAndAccount: Task & Account, lead: Lead): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const crm = new AmoCRM({
                domain: consts.amoSettings.domain,
                auth: {
                    login: consts.amoSettings.login,
                    hash: consts.amoSettings.hash,
                },
            });
            const accountId = taskAndAccount.crmaccountid;
            // const accountId = '10338573'; // тестовые данные
            let customFields: any = [];
            if (taskAndAccount.usercount && taskAndAccount.enddateutc) {
                customFields = [
                    {
                        id: consts.amoCustomFields.nameId,
                        values: [{ value: accountId }],
                        is_system: false
                    },
                    {
                        id: consts.amoCustomFields.countUserId,
                        values: [{ value: taskAndAccount.usercount ? taskAndAccount.usercount : 0 }], // taskAndAccount.usercount
                        is_system: false
                    },
                    {
                        id: consts.amoCustomFields.endAccountId,
                        values: [{ value: taskAndAccount.enddateutc ? taskAndAccount.enddateutc : 0 }],
                        is_system: false
                    },
                    {
                        id: consts.amoCustomFields.payAmoId,
                        values: [{ value: this.tariffNamePay(taskAndAccount.tariffid, taskAndAccount.usercount) }],
                        is_system: false
                    }];
            }
            crm.connect()
                .then(() => {
                    crm.request
                        .post('/api/v2/leads', {
                            update: [
                                {
                                    custom_fields: customFields,
                                    id: lead.id,
                                    name: lead.name,
                                    updated_at: new Date().getTime(),
                                }
                            ]
                        })
                        .then((data: any) => {
                            return resolve(true);
                        })
                        .catch((err: any) => {
                            log('Произошла ошибка обновления сделки', err);
                            this.isprocessingTaskFalse(taskAndAccount, 'error');
                            return resolve(false);
                        })
                })
                .catch((err: any) => {
                    log('Ошибка входа', err);
                    crm.disconnect();
                });
        });
    }

    public async HandlerTask(taskAndAccount: Task & Account, lead: Lead): Promise<string> {
        return new Promise((resolve, reject) => {
            const crm = new AmoCRM({
                domain: consts.amoSettings.domain,
                auth: {
                    login: consts.amoSettings.login,
                    hash: consts.amoSettings.hash,
                },
            });
            const eventTask = taskAndAccount.event; // для продакшена
            const dateEnd = new Date(taskAndAccount.enddateutc);
            // tslint:disable-next-line: max-line-length
            const endDate = ('0' + dateEnd.getDate()).slice(-2) + '-' + ('0' + (dateEnd.getMonth() + 1)).slice(-2) + '-' + dateEnd.getFullYear();
            // let eventTask = 2; // для development тестовые данные тип Таска
            let statusHandlerTask: string = 'status is Null';
            crm.connect()
                .then(async () => {
                    let res: any;
                    let boolTaskCheck: boolean = false;
                    // передать дату окончания акк в метод возвращающий дату минус 20 рабочих дней
                    const completeTillTask = await this.data20WorkingDay(dateEnd, consts.timeZone);
                    let dataNow = moment(new Date()).unix();
                    // log('dataNow = ', dataNow);
                    // log('dataNow.unix() = ', dataNow.unix());
                    // log('completeTillTask = ', completeTillTask);
                    res = await crm.request.get(`/api/v2/tasks?element_id=${lead.id}&type=lead`)
                        .then((data: any) => {
                            if (data._embedded.items) {
                                return data._embedded.items;
                            } else {
                                throw Error('not find task in lead-id');
                            }
                        })
                        .catch((err: any) => {
                            log('Произошла ошибка при получении задач по сделке', err);
                            this.isprocessingTaskFalse(taskAndAccount, 'error');
                        })
                    if (eventTask === 1 && !taskAndAccount.havepartner) {
                        // tslint:disable-next-line: prefer-for-of
                        for (let i = 0; i < res.length; i++) {
                            if (res[i].is_completed) { continue }
                            // находим незавершенные таски
                            const textTask: string = res[i].text;
                            if (textTask.indexOf(consts.textTaskH.textSearch) > 0) {
                                // обновление таска
                                boolTaskCheck = true;
                                crm.request
                                    .post('/api/v2/tasks', {
                                        update: [
                                            {
                                                complete_till_at: completeTillTask,
                                                id: res[i].id,
                                                responsible_user_id: lead.responsible_user_id,
                                                task_type: consts.taskTypeAmo,
                                                text: this.textTaskHandler(consts.textTaskH, endDate, taskAndAccount.tariffname, taskAndAccount.usercount),
                                                updated_at: new Date().getTime(),
                                            },
                                        ],
                                    })
                                    .then((data1: any) => {
                                        statusHandlerTask = 'Задача обновлена';
                                        return resolve(statusHandlerTask);
                                    })
                                    .catch((e: string) => {
                                        log(e);
                                        crm.disconnect();
                                    });
                            }
                        }
                        if (taskAndAccount.havepartner) { return };
                        if (boolTaskCheck) { return };
                        if (completeTillTask < dataNow) {
                            statusHandlerTask = 'Задача создана';
                            return resolve(statusHandlerTask);
                        };
                        // создание таска, когда задача по закрытию не найдена
                        crm.request
                            .post('/api/v2/tasks', {
                                add: [
                                    {
                                        complete_till_at: completeTillTask,
                                        created_at: new Date().getTime(),
                                        element_id: lead.id,
                                        element_type: consts.taksType,
                                        responsible_user_id: lead.responsible_user_id,
                                        task_type: consts.taskTypeAmo,
                                        text: this.textTaskHandler(consts.textTaskH, endDate, taskAndAccount.tariffname, taskAndAccount.usercount),
                                    },
                                ],
                            })
                            .then((data1: any) => {
                                statusHandlerTask = 'Задача создана';
                                crm.disconnect();
                                return resolve(statusHandlerTask);
                            })
                            .catch((e: string) => {
                                log(e);
                                crm.disconnect();
                            });
                    } else if (eventTask === 2 || taskAndAccount.havepartner) {
                        let updateBool: boolean = false;
                        // tslint:disable-next-line: prefer-for-of
                        for (let i = 0; i < res.length; i++) {
                            if (res[i].is_completed) { continue }
                            // находим незавершенные таски
                            const textTask: string = res[i].text;
                            if (textTask.indexOf(consts.textTaskH.textSearch) > 0) {
                                updateBool = true;
                                // закрытие таска
                                crm.request
                                    .post('/api/v2/tasks', {
                                        update: [
                                            {
                                                id: res[i].id,
                                                is_completed: true,
                                                task_type: consts.taskTypeAmo,
                                                updated_at: new Date().getTime(),
                                            },
                                        ],
                                    })
                                    .then((data1: any) => {
                                        statusHandlerTask = 'Задача закрыта';
                                        return resolve(statusHandlerTask);
                                    })
                                    .catch((e: string) => {
                                        log(e);
                                        crm.disconnect();
                                    });
                            }
                        }
                        if (!updateBool) {
                            return resolve(statusHandlerTask);
                        }
                    }
                })
                .catch((err: any) => {
                    log('Ошибка входа', err);
                    crm.disconnect();
                });
        });
    }

    public async GeneralMethod() {
        try {
            const taskAndAcc = await this.GetOneFromTaskBd();
            const flead = this.FindLead(taskAndAcc);
            flead.then(async (lead) => {
                const boolUpdate = await this.UpdateLead(taskAndAcc, lead);
                if (boolUpdate) {
                    const statusHandlerTask = await this.HandlerTask(taskAndAcc, lead);
                    log('Статус обработчика задач = ', statusHandlerTask);
                    const statusIsprocessingFalse = await this.isprocessingTaskFalse(taskAndAcc, statusHandlerTask);
                    if (statusIsprocessingFalse) { log('task sets finish'); }
                }
            })
        } catch (error) {
            log(error);
        }
    }

    private tariffNamePay(tarifid: number, userCount: number): number {
        let res: number = 0;
        switch (tarifid) {
            case 8403805: {
                return res = 499 * userCount * 6; // базовый
            }
            case 19208542: {
                return res = 999 * userCount * 6; // расширенный
            }
            case 8404057: {
                return res = 4999; // микро бизнес
            }
            case 8403985: {
                return res = 1499 * userCount * 6; // профессиональный
            }
            case 8403988: {
                return res = 1499 * userCount * 6; // профессиональный
            }
            case 8404105: {
                return res = 14999; // стартап
            }
            case 8198636: {
                return res = 14999; // Старт-Ап
            }
            case 14911954: {
                return res = 999 * userCount * 6; // расширенный (апрель)
            }
            case 8403880: {
                return res = 799 * userCount * 6; // расширенный архивный
            }
            case 41208: {
                return res = 3000; // Максимальный
            }
            default: {
                return res = 0;
            }
        }
    }

    private mergeObject<Tsk, Acc>(a: Tsk, b: Acc) {
        return Object.assign({}, a, b)
    }

    private data20WorkingDay(dataEnd: Date, timeZone: number) {
        try {
            let dataEndMoment = moment(dataEnd);
            let countWorkingDay = 20;
            while (countWorkingDay > 0) { // вычитаем по одному рабочему дню и проверяем не является ли он праздничным
                dataEndMoment = business.addWeekDays(dataEndMoment, -1);
                let even = (element: any) => element === dataEndMoment.format('DD-MM-YYYY');
                if (consts.arrayDayOfHoliday.some(even)) {
                    continue;
                } else {
                    countWorkingDay--;
                }
            }
            dataEndMoment.set({ 'hour': 23, 'minute': 59, 'second': 59 });
            // dataEndMoment.endOf('day');
            dataEndMoment.hour(-(timeZone));
            // dataEndMoment.second(-1);
            return dataEndMoment.unix();
        } catch (error) {
            log(error);
            throw new Error(error);
        }
    }

    // '[amo licence] Завершение оплаты amoCRM {endDate}, тариф {tariffname}, кол-во пользователей {usercount}. Сделай предложение!';
    private textTaskHandler(text: any, enddate: string, tariffname: string, usercount: number): string {
        const result = `${text.text1}${enddate}${text.text2}${tariffname}${text.text3}${usercount}${text.text4}`;
        return result;
    }
    // в зависимости от статуса выполнения программы выставляются в таск параметры
    private async isprocessingTaskFalse(task: Task & Account, status: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            createConnection({
                type: consts.cnType,
                host: consts.cnHost,
                port: consts.cnPort,
                username: consts.cnUsername,
                password: consts.cnPassword,
                database: consts.cnDatabase,
                entities: [
                    Account, Task,
                ],
                synchronize: false,
                logging: false,
            }).then(async connection => {
                if (task.id) {
                    if (status === 'error') {
                        // await connection.manager.query(.`update task set isprocessing = false where id = ${task.id}`);
                        const addMinutes = 2 ** (task.attemptcount ? task.attemptcount : 1);
                        await connection.manager.query(`update task set isprocessing = false, nexttrydateutc = current_date + interval '${String(addMinutes)} minutes', attemptcount = attemptcount + 1  where id = ${task.id}`);
                        log('status error, task set isprocessing = false');
                        return resolve(true);
                    }
                    if (status === 'status is Null') {
                        // nexttrydateutc + attemptcount ${String(addMinutes)} minute
                        const addMinutes = 2 ** (task.attemptcount ? task.attemptcount : 1);
                        // log('addMinutes = ' , addMinutes);
                        await connection.manager.query(`update task set isprocessing = false, nexttrydateutc = current_date + interval '${String(addMinutes)} minutes', attemptcount = attemptcount + 1  where id = ${task.id}`);
                        log('status is Null, task set isprocessing = false');
                        return resolve(true);
                    } else {
                        // processeddate 
                        await connection.manager.query(`update task set isprocessing = false, processeddateutc = current_date where id = ${task.id}`);
                        return resolve(true);
                    }
                } else {
                    return resolve(false);
                }
            }).catch((error: any) => {
                log(error);
                return resolve(false);
            });
        });
    }
}

const WorkerStart = new Worker();

WorkerStart.GeneralMethod();

export { Worker };