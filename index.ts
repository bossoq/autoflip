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
let interval: NodeJS.Timeout | undefined;
let running = true;
let coin = 0;
let farmIncome = 0;
let investIncome = 0;

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

  const chatClient = new ChatClient({authProvider: auth, channels: [channel] });

  const clearFarmInterval = () => {
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }
  };
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

  const invest = async (amount: number) => {
    if (!running) return;
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
    clearFarmInterval();
    farm();
    interval = setInterval(farm, farmIntervalMs);
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
          clearFarmInterval();
        }
      }
      if (message === "!result") {
        console.log(`${coin} coin, ${farmIncome} farm income, ${investIncome} invest income`);
        chatClient.say(channel, `${coin} coin, ${farmIncome} farm income, ${investIncome} invest income`);
      }
      if (message === "!reset") {
        coin = 0;
        farmIncome = 0;
        investIncome = 0;
      }
    }
    if (!botName.includes(user.toLowerCase())) return;
    const farmMessage = message.match(/@bosssoq ฟาร์มได้ (\d+) \$OULONG/);
    const investMessage = message.match(
      /@bosssoq .+ ลงทุน (\d+) -> ได้ผลตอบแทน (\d+) \$OULONG \((\d+)\)/
    );
    const coinMessage = message.match(/@bosssoq has (\d+) \$OULONG/);
    const waitMessage = message.match(/@bosssoq รออีก (\d+) วินาที/);
    const notLiveMessage = message.match(/@bosssoq ฟาร์มได้เฉพาะตอน Live เท่านั้น/)
    if (farmMessage) {
      let lastFarm = parseInt(farmMessage[1]);
      farmIncome += lastFarm;
      invest(lastFarm);
    } else if (investMessage) {
      investIncome -= parseInt(investMessage[1]);
      investIncome += parseInt(investMessage[2]);
      coin = parseInt(investMessage[3]);
    } else if (coinMessage) {
      coin = parseInt(coinMessage[1]);
    } else if (waitMessage) {
      clearFarmInterval();
      setTimeout(() => {
        farm();
        interval = setInterval(farm, farmIntervalMs);
      }, (parseInt(waitMessage[1]) + 5) * 1000);
    } else if (notLiveMessage) {
      running = false;
      clearFarmInterval();
    }
  });

  await chatClient.connect();
};

main();
