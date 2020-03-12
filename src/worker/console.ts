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

    public async updateTask(accountId: number): Promise<boolean> {
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
                await connection.manager.query(`UPDATE public.task SET processeddateutc = null, attemptcount = 0  where crmaccountid = ${accountId}`);
                connection.close();
                return resolve(true);
            }).catch((error: any) => {
                log(error);
                // connection.close();
                throw new Error(error);
            });
        });
    }

    public async FindLeadsPipeline(idPipeline: number, limitOffset: number): Promise<[]> {
        return new Promise((resolve, reject) => {
            const crm = new AmoCRM({
                domain: consts.amoSettings.domain,
                auth: {
                    login: consts.amoSettings.login,
                    hash: consts.amoSettings.hash,
                },
            });
            crm.connect()
                .then(() => {
                    crm.request.get(`/api/v2/leads/?status=${idPipeline}&limit_rows=500&limit_offset=${limitOffset}`)
                        .then((data: any) => {
                            // log( 'Полученные данные', data );
                            if (data._embedded !== undefined) {
                                const res = data._embedded.items;
                                return resolve(res);
                            }
                        })
                        .catch((err: any) => {
                            log('Произошла ошибка', err);
                            crm.disconnect();
                            throw new Error('FindLeadsPipeline error')
                        })
                })
                .catch((err: any) => {
                    log('Ошибка входа', err);
                    crm.disconnect();
                });
        });
    }

    public async UpdateLead(lead: any): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const crm = new AmoCRM({
                domain: consts.amoSettings.domain,
                auth: {
                    login: consts.amoSettings.login,
                    hash: consts.amoSettings.hash,
                },
            });
            let customFields: any = [];
            if (lead) {
                customFields = [
                    {
                        id: consts.amoCustomFields.nameId,
                        values: [{ value: null }],
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
                            // this.isprocessingTaskFalse(taskAndAccount, 'error');
                            return resolve(false);
                        })
                })
                .catch((err: any) => {
                    log('Ошибка входа', err);
                    crm.disconnect();
                });
        });
    }

    public async handlerTaskAndLead(dataLeads:any []): Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            try {
                this.sleep(2000);
                let boolResultHandler: boolean = false;
                for (let lead of dataLeads) {
                    let leadItem: any = lead;
                    let arrayCustomFields: [] = leadItem.custom_fields;
                    let itemIdAmo: any;
                    // let itemIdAmo: any = arrayCustomFields.find((item: any) => {
                    //     if (item.id === consts.amoCustomFields.nameId) {
                    //         return true;
                    //     } else { return false; } 
                    // })
                    for (let item of arrayCustomFields) {
                        let itemX: any = item;
                        if (itemX.id === consts.amoCustomFields.nameId) {
                            itemIdAmo = itemX;
                        } else { continue; }
                    }
                    // log('itemIdAmo = ', itemIdAmo);
                    // log('itemIdAmo.values[0].value = ', itemIdAmo.values[0].value);
                    let accountId: number;
                    if (itemIdAmo) {
                        accountId = itemIdAmo.values[0].value;
                    } else {
                        continue;
                    };
                    // log('accountId = ', accountId);
                    const boolUpdateLead = await this.UpdateLead(leadItem);
                    if (boolUpdateLead) {
                        const boolUpdateTask = await this.updateTask(accountId);
                        if (boolUpdateTask) {
                            boolResultHandler = true;
                            log('OK');
                        } else {
                            log('BAD');
                        }
                    }
                }
                log('boolResult 500 = ', boolResultHandler);
                return resolve(true);
            } catch (error) {
                log(error);
                throw new Error(error);
            };
        });
    }

    public async GeneralMethod() {
        try {
            const idPipeline: number = 576226;
            const idStatus: number = 14673973;
            let limitOffset: number = 0;
            let arrayLeads:any[] = [];
            for (let i = 0; i < 11; i++) {
                const dataPipeline:any[] = await this.FindLeadsPipeline(idStatus, i*500);
                // dataPipeline.then(async (leads) => {
                    // log('dataPipeline = ', dataPipeline);
                    // arrayLeads.push(dataPipeline);
                    // arrayLeads = await arrayLeads.concat(dataPipeline);
                    // log('arrayLeads.length = ', arrayLeads.length);
                    // arrayLeads = [...arrayLeads, ...dataPipeline];
                    const boolResult = await this.handlerTaskAndLead(dataPipeline);
                    // log('boolResult 500 = ', boolResult);
                // });
            }
            // log('arrayLeads = ', arrayLeads);
            // log('arrayLeads.length = ', arrayLeads.length);
        } catch (error) {
            log(error);
        }
    }

    private async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const WorkerStart = new Worker();

WorkerStart.GeneralMethod();

export { Worker };