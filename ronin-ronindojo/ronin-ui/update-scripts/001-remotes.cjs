const { userInfo } = require("os");
const path = require("path");

const homeDir = userInfo({ encoding: "utf8" }).homedir;

const modifyDojoRemotes = async (execa) => {
  const dojoExeca = execa({ stdout: "inherit", cwd: path.join(homeDir, "dojo") });

  await dojoExeca`git remote remove origin`;
  await dojoExeca`git remote add origin http://2l2o5umijiwxjioxwpsvwxe6pr75tj7r5rggnl5ze256guwvtee3kpqd.onion/Ronin/dojo.git`;
};

const modifyRoninRemotes = async (execa) => {
  const roninExeca = execa({ stdout: "inherit", cwd: path.join(homeDir, "RoninDojo") });

  await roninExeca`git remote remove origin`;
  await roninExeca`git remote add origin http://2l2o5umijiwxjioxwpsvwxe6pr75tj7r5rggnl5ze256guwvtee3kpqd.onion/Ronin/ronindojo.git`;
};

const updateRemotes = async () => {
  const { $ } = await import("execa");

  try {
    const { stdout: dojoRemotes } = await $({ cwd: path.join(homeDir, "dojo") })`git remote -v`;
    const { stdout: roninRemotes } = await $({ cwd: path.join(homeDir, "RoninDojo") })`git remote -v`;

    const hasNewRemotes = dojoRemotes.includes("onion") && roninRemotes.includes("onion");

    if (hasNewRemotes) {
      console.log("No new remotes to add");
    } else {
      await $({ stdout: "inherit" })`git config --global http.proxy socks5h://127.0.0.1:9050`;
      await Promise.all([modifyDojoRemotes($), modifyRoninRemotes($)]);
    }
  } catch (error) {
    console.error("Postupdate script failed", error);
  }
};

module.exports = updateRemotes;
