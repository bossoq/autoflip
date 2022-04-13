import { RefreshingAuthProvider } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";
import { promises as fs } from "fs";
import {
  farm,
  clientId,
  clientSecret,
  channel,
} from "./data/gacha_config.json";

const farmIntervalMs = (farm * 60 + 5) * 1000;
const botName = ["narzebot", "narzebotdev"];
const userName = "bosssoq";
let interval: ReturnType<typeof setInterval>;
let running = true;
let coin = 0;
let income = 0;
let lastFarm = 0;

const main = async () => {
  const tokenData = JSON.parse(
    await fs.readFile("./data/tokens.json", "utf-8")
  );
  const auth = new RefreshingAuthProvider(
    {
      clientId,
      clientSecret,
      onRefresh: async (newTokenData) =>
        await fs.writeFile(
          "./data/tokens.json",
          JSON.stringify(newTokenData, null, 2),
          "utf-8"
        ),
    },
    tokenData
  );

  const chatClient = new ChatClient(auth, { channels: [channel] });

  const checkCoin = async () => {
    await chatClient.say(channel, "!coin").then(
      () => {
        console.log("coin checked");
      },
      (reason) => {
        console.log("coin check failed: " + reason);
      }
    );
  };

  const invest = async () => {
    if (!running) return;
    let amount = lastFarm > 0 ? lastFarm : 1;
    const message = `!invest ${amount}`;
    await chatClient.say(channel, message).then(
      () => {
        console.log("Sent", { message });
      },
      (reason) => {
        console.error("Not sent", { reason });
      }
    );
  };

  const farm = async () => {
    if (!running) return;

    const message = "!farm";
    await chatClient.say(channel, message).then(
      () => {
        console.log("Sent", { message });
      },
      (reason) => {
        console.error("Not sent", { reason });
      }
    );
  };

  const initBot = () => {
    checkCoin();
    if (interval) clearInterval(interval);
    interval = setInterval(farm, farmIntervalMs);
    farm();
  };

  chatClient.onRegister(() => {
    console.log("CONNECTED", { channel });

    initBot();
  });

  chatClient.onMessage((_channel, user, message) => {
    if (user.toLowerCase() === userName) {
      if (message === "!start") {
        if (!running) {
          running = true;
          initBot();
        }
      }
      if (message === "!stop") {
        if (running) {
          running = false;
          clearInterval(interval);
        }
      }
      if (message === "!result") {
        console.log(`${coin} coin, ${income} income`);
        chatClient.say(channel, `${coin} coin, ${income} income`);
      }
      if (message === "!reset") {
        coin = 0;
        income = 0;
        lastFarm = 0;
      }
    }
    if (!botName.includes(user.toLowerCase())) return;
    const farmMessage = message.match(/@bosssoq ฟาร์มได้ (\d+) \$OULONG/);
    const investMessage = message.match(
      /@bosssoq ลงทุน (\d+) -> ได้ผลตอบแทน (\d+) \$OULONG \((\d+)\)/
    );
    const coinMessage = message.match(/@bosssoq has (\d+) \$OULONG/);
    const waitMessage = message.match(/@bosssoq รออีก (\d+) วินาที/);
    if (farmMessage) {
      lastFarm = parseInt(farmMessage[1]);
      income += lastFarm;
      invest();
    } else if (investMessage) {
      income -= parseInt(investMessage[1]);
      income += parseInt(investMessage[2]);
      coin = parseInt(investMessage[3]);
    } else if (coinMessage) {
      coin = parseInt(coinMessage[1]);
    } else if (waitMessage) {
      clearInterval(interval);
      setTimeout(() => {
        interval = setInterval(farm, farmIntervalMs);
        farm();
      }, (parseInt(waitMessage[1]) + 5) * 1000);
    }
  });

  await chatClient.connect();
};

main();
