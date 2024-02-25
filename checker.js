const https = require("https");
const fns = require("date-fns");
const openPromise = import("open");
const readline = require("readline");
const player = require("play-sound")();

// Function to play a sound
function playAlertSound() {
  // Replace 'alert.mp3' with the path to the sound file you want to play
  player.play("call-to-attention-123107.mp3", (err) => {
    if (err) {
      console.log("Failed to play sound:", err);
    }
  });
}

// Function to move the cursor up by a certain number of lines and clear those lines
function clearLastLine(numberOfLines = 1) {
  for (let i = 0; i < numberOfLines; i++) {
    process.stdout.moveCursor(0, -1); // Move cursor up one line
    process.stdout.clearLine(1); // Clear the line
  }
}

// Function to wrap text with an ANSI escape code for color
function colorText(text, colorCode) {
  // ANSI escape code starts with \x1b[
  // Reset code \x1b[0m ensures the color reset after the text is printed
  return `\x1b[${colorCode}m${text}\x1b[0m`;
}

let alertInterval = -1;
let linesToClear = 0;
let ignoredTimes = [];
let currentTimes = [];

// Function to check appointment availability
function checkAvailability() {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.on("keypress", (str, key) => {
    if (key.sequence === "s") {
      openPromise.then((open) => {
        open.default("https://ttp.cbp.dhs.gov/");
      });
    }

    if (key.sequence === "i") {
      currentTimes.forEach((t) => ignoredTimes.push(t));
      console.log(
        "Ignored successfully. Chime will not ring anymore for these appointment times."
      );
      linesToClear++;
      clearInterval(alertInterval);
    }

    if (key.ctrl && key.name === "c") {
      process.exit(); // Exit the program when CTRL+C is pressed
    }
  });

  const url =
    "https://ttp.cbp.dhs.gov/schedulerapi/slot-availability?locationId=9200";

  https
    .get(url, (res) => {
      let data = "";

      // A chunk of data has been received.
      res.on("data", (chunk) => {
        data += chunk;
      });

      // The whole response has been received.
      res.on("end", () => {
        clearLastLine(linesToClear);
        const response = JSON.parse(data);
        clearInterval(alertInterval);
        currentTimes = [];

        if (response.availableSlots && response.availableSlots.length > 0) {
          if (
            response.availableSlots.some((slot) => {
              const startDate = fns.parseISO(slot.startTimestamp);

              const isIgnored = ignoredTimes.some((ignoredTime) => {
                const isSame = fns.isSameMinute(startDate, ignoredTime);
                return isSame;
              });

              const isEarlyEnough = fns.isBefore(
                startDate,
                new Date("April 14, 2024 00:00:00")
              );

              return !isIgnored && isEarlyEnough;
            })
          ) {
            playAlertSound();
            alertInterval = setInterval(playAlertSound, 10000);

            let plural = response.availableSlots.length > 1 ? "s are" : " is";
            console.log(
              colorText(
                `${response.availableSlots.length} appointment slot${plural} available!`,
                32
              )
            );

            response.availableSlots.forEach((slot) => {
              const startDate = fns.parseISO(slot.startTimestamp);
              currentTimes.push(startDate);
              console.log(
                colorText(fns.format(startDate, "MMMM do 'at' h:mm aaaa"), 36)
              );
            });
            console.log(
              "To claim an appointment slot, press S to open the scheduler on this computer"
            );
            console.log(
              `Or, go to ${colorText(
                "https://ttp.cbp.dhs.gov/",
                36
              )} on another computer`
            );
            console.log(
              "If this appointment time doesn't work, press I to ignore and stop the chimes."
            );
            linesToClear = response.availableSlots.length + 4;
          } else {
            console.log(
              `No good slots available as of ${fns.format(
                new Date(),
                "h:mm a"
              )}`
            );
            linesToClear = 1;
          }
        } else {
          console.log(
            `No slots available as of ${fns.format(new Date(), "h:mm a")}`
          );
          linesToClear = 1;
        }
      });
    })
    .on("error", (err) => {
      clearInterval(alertInterval);
      console.log(
        colorText(
          `[${fns.format(new Date(), "h:mm a")}] Error: ${err.message}`,
          31
        )
      );
      console.log(
        colorText(
          `Contact the developer if this error persists for more than 5 minutes`,
          31
        )
      );
      linesToClear = 1;
    });
}

// Check availability every 5 minutes
setInterval(checkAvailability, 5 * 60 * 1000);

// Also, check immediately when the script starts
checkAvailability();
