/* настройки для коннекшена к базе постгреса */
const cnType = '';
const cnHost = '';
const cnPort = 0;
const cnUsername = '';
const cnPassword = '';
/* настройки для коннекшена к амо срм */
const cnDatabase = 'amo';

const amoSettings = { // Prodaction version
    login: 'test@test.com',
    hash: 'e95e328c81c580423b26a2db2e2b5166b3f0d1',
    domain: 'test.amocrm.ru',
};

// const amoSettings = { // Develop version 0
//     login: 'test@test.com',
//     hash: 'e95e328c81c580423b26a2db2e2b5166b3f0d1',
//     domain: 'test.amocrm.ru',
// };

const amoCustomFields = { // Prodaction version
    countUser: 'Кол-во уч в CRM',
    countUserId: 636304,
    endAccount: 'Сл оплата амо',
    endAccountId: 636312,
    name: 'ID AMO',
    nameId: 605799,
    payAmo: 'Чек в амо',
    payAmoId: 637656,
};

// const amoCustomFields = { // Develop version
//     countUser: 'Кол-во уч в CRM',
//     countUserId: 652023,
//     endAccount: 'Сл оплата амо',
//     endAccountId: 652025,
//     name: 'ID AMO',
//     nameId: 651677,
//     payAmo: 'Чек в амо',
//     payAmoId: 652069,
// };

const taskTypeAmo = 780970; // тип задачи которую мы ставим в сделке
// текст для тасков
const textTaskH = {
    text1: '[amo licence] Завершение оплаты amoCRM ',
    text2: ', тариф ',
    text3: ', кол-во пользователей ',
    text4: '. Сделай предложение!',
    textSearch: 'amo licence',
}

// '[amo licence] Завершение оплаты amoCRM {endDate}, тариф {tariffname}, кол-во пользователей {usercount}. Сделай предложение!';
/* тип задачи, которую мы ставим менеджерам (сейчас это оплата) */
const taksType = 2;

// константы для запросов в БД
const eventTask = 1;
const eventCloseAllTasks = 2;
const quantityAmoAcc = 5;
const queryToBdTaskGetOne = `select * from public.task where ((task.isprocessing is false and processeddateutc is null) and ( nexttrydateutc < current_date or nexttrydateutc is null ) ) order by id asc LIMIT 1 OFFSET 0`;
const timeOut = 90000;
const timeZone = 5;

const arrayDayOfHoliday = [
    "01-01-2020","02-01-2020","03-01-2020","06-01-2020","07-01-2020","08-01-2020","24-02-2020","09-03-2020",
    "01-05-2020","04-05-2020","05-05-2020","11-05-2020","12-06-2020","04-11-2020",
];

export {
    cnType,
    cnHost,
    cnPort,
    cnUsername,
    cnPassword,
    cnDatabase,
    amoSettings,
    amoCustomFields,
    taksType,
    taskTypeAmo,
    textTaskH,
    timeZone,
    quantityAmoAcc,
    queryToBdTaskGetOne,
    timeOut,
    eventTask,
    eventCloseAllTasks,
    arrayDayOfHoliday,
};
