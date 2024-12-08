
const { Client, Intents, MessageActionRow, MessageButton } = require('discord.js');
const fs = require('fs');

// Ініціалізація бота
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGES,
  ],
});

// Зчитування даних з файлів
let fruitData = JSON.parse(fs.readFileSync('fruit_data.json', 'utf-8'));
let userData = JSON.parse(fs.readFileSync('user_data.json', 'utf-8'));

// Структура для зберігання мов
const languages = {
  uk: {
    start: "Привіт! Я допоможу вам розрахувати дозу інсуліну для фруктів. Виберіть мову:",
    chooseFruit: "Оберіть фрукт:",
    chooseWeight: "Введіть вагу фруктів у грамах (наприклад, 100):",
    insulinDose: "Вам потрібно вколоти {dose} одиниць інсуліну для {weight} г {fruit}.",
    invalidFruit: "Цей фрукт не підтримується.",
    invalidWeight: "Будь ласка, введіть правильну кількість грамів.",
    setInsulin: "Оберіть фрукт для зміни дозування інсуліну:",
    setInsulinAmount: "Введіть нову кількість інсуліну на 10 г для {fruit} (формат: число):",
    invalidInsulin: "Будь ласка, введіть правильну кількість інсуліну на 10 г.",
  },
  en: {
    start: "Hello! I can help you calculate insulin doses for fruits. Choose a fruit:",
    chooseFruit: "Choose a fruit:",
    chooseWeight: "Enter the weight of the fruit in grams (e.g., 100):",
    insulinDose: "You need to inject {dose} units of insulin for {weight} g of {fruit}.",
    invalidFruit: "This fruit is not supported.",
    invalidWeight: "Please enter a valid number of grams.",
    setInsulin: "Choose a fruit to change insulin dosage:",
    setInsulinAmount: "Enter the new insulin amount per 10 g for {fruit} (format: number):",
    invalidInsulin: "Please enter a valid insulin amount per 10 g.",
  }
};

let userLanguage = 'uk';  // за замовчуванням українська

// Функція для розрахунку дози інсуліну
function calculateInsulin(fruit, weight, userId, language) {
  const userInsulinData = userData[userId]?.insulin;
  const fruitInfo = fruitData[fruit];

  if (!fruitInfo) {
    return languages[language].invalidFruit;
  }

  // Перевірка наявності індивідуальних налаштувань для користувача
  let insulinPer10g = fruitInfo.insulin_per_10g;
  if (userInsulinData && userInsulinData[fruit]) {
    insulinPer10g = userInsulinData[fruit];  // Використовуємо налаштування користувача
  }

  const carbs = (fruitInfo.carbs_per_100g * weight) / 100;
  const insulinDose = (carbs / 10) * insulinPer10g;

  return languages[language].insulinDose.replace("{dose}", insulinDose.toFixed(2))
    .replace("{weight}", weight)
    .replace("{fruit}", fruit);
}

// Завантаження і збереження даних користувачів
function saveUserData() {
  try {
    fs.writeFileSync('user_data.json', JSON.stringify(userData, null, 2));
    console.log('User data saved');
  } catch (error) {
    console.error('Error saving user data:', error);
  }
}

// Обробка команд та повідомлень
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;

  if (message.content === '/start') {
    // Користувач вибирає мову
    userData[userId] = userData[userId] || { state: null, currentFruit: null, weight: null };
    userData[userId].state = 'select_language';  // Перехід до вибору мови
    saveUserData();

    const row = new MessageActionRow()
      .addComponents(
        new MessageButton().setCustomId('uk').setLabel('Українська').setStyle('PRIMARY'),
        new MessageButton().setCustomId('en').setLabel('English').setStyle('PRIMARY')
      );

    message.reply({
      content: languages[userLanguage].start,
      components: [row]
    });
  } else if (message.content === '/setInsulin') {
    // Користувач вибирає фрукт для зміни дозування
    userData[userId] = userData[userId] || { insulin: {}, currentFruit: null, state: null };
    userData[userId].state = 'select_fruit_for_insulin';  // Перехід до вибору фрукту
    saveUserData();

    const row = new MessageActionRow()
      .addComponents(
        new MessageButton().setCustomId('apple').setLabel('Яблуко').setStyle('PRIMARY'),
        new MessageButton().setCustomId('banana').setLabel('Банан').setStyle('PRIMARY'),
        new MessageButton().setCustomId('orange').setLabel('Апельсин').setStyle('PRIMARY')
      );

    message.reply({
      content: languages[userLanguage].setInsulin,
      components: [row]
    });
  }
});

// Обробка вибору мови
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const userId = interaction.user.id;

  if (interaction.customId === 'uk' || interaction.customId === 'en') {
    userLanguage = interaction.customId;
    userData[userId] = userData[userId] || { state: 'select_fruit' };
    saveUserData();

    const row = new MessageActionRow()
      .addComponents(
        new MessageButton().setCustomId('apple').setLabel('Яблуко').setStyle('PRIMARY'),
        new MessageButton().setCustomId('banana').setLabel('Банан').setStyle('PRIMARY'),
        new MessageButton().setCustomId('orange').setLabel('Апельсин').setStyle('PRIMARY')
      );

    await interaction.reply({
      content: languages[userLanguage].chooseFruit,
      components: [row]
    });
  }

  if (interaction.customId === 'apple' || interaction.customId === 'banana' || interaction.customId === 'orange') {
    const fruit = interaction.customId;
    userData[userId].currentFruit = fruit;

    if (userData[userId].state === 'select_fruit_for_insulin') {
      // Переходимо до запиту кількості інсуліну для вибраного фрукта
      userData[userId].state = 'set_insulin_amount';
      saveUserData();

      await interaction.reply(languages[userLanguage].setInsulinAmount.replace("{fruit}", fruit));  // Питання про кількість інсуліну
    } else {
      // Якщо це не для /setInsulin, переходимо до введення ваги
      userData[userId].state = 'choose_weight';  // Перехід до введення ваги
      saveUserData();

      await interaction.reply(languages[userLanguage].chooseWeight);  // Питання про вагу
    }
  }
});

// Обробка вводу ваги фрукту для /start
client.on('messageCreate', (message) => {
  const userId = message.author.id;
  const state = userData[userId]?.state;
  const currentFruit = userData[userId]?.currentFruit;

  if (state === 'choose_weight') {
    const weight = parseFloat(message.content);
    if (isNaN(weight) || weight <= 0) {
      return message.reply(languages[userLanguage].invalidWeight);
    }

    // Зберігаємо вагу
    userData[userId].weight = weight;
    userData[userId].state = null;  // Завершуємо сесію після введення ваги
    saveUserData();

    // Розраховуємо дозу інсуліну
    const doseMessage = calculateInsulin(currentFruit, weight, userId, userLanguage);
    message.reply(doseMessage);  // Відправляємо результат
  }

  // Обробка вводу інсуліну для /setInsulin
  if (state === 'set_insulin_amount') {
    const insulinAmount = parseFloat(message.content);
    if (isNaN(insulinAmount) || insulinAmount <= 0) {
      return message.reply(languages[userLanguage].invalidInsulin);
    }

    // Оновлюємо дозу інсуліну для фрукта користувача
    userData[userId].insulin[currentFruit] = insulinAmount;
    userData[userId].state = null;  // Завершуємо сесію після оновлення дозування
    saveUserData();

    message.reply(`Ваша нова кількість інсуліну для ${currentFruit} на 10 г: ${insulinAmount}`);
  }
});
// Вхід бота
client.login('');