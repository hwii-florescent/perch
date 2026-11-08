import { expect, it } from "vitest";
import { programFor, programTable } from "./programs";

it("names a program from its command line: interpreters show what they run, shells are shell, unknown is program", () => {
  expect(programFor("claude --resume").name).toBe("Claude");
  expect(programFor(["node", "/p/node_modules/.bin/vite.js"]).id).toBe("vite");
  expect(programFor("npx vitest run").id).toBe("vitest");
  expect(programFor("/bin/zsh -l").id).toBe("shell");
  expect(programFor("lazygit").id).toBe("git"); // by `match`
  const odd = programFor("frobnicate --x");
  expect(odd).toMatchObject({ id: "program", name: "frobnicate" });
  expect(programFor("frobnicate").tile).toBe(odd.tile); // a colour of its own, stable
});

it("programs.json adds entries and changes built-ins field by field, with its own shells and interpreters", () => {
  const file = {
    programs: { lazygit: { name: "Git UI", tile: "#000000" }, mytool: { name: "My Tool", match: ["mytool-dev"], run: ["mytool"] }, claude: { run: ["my-claude"] } },
    shells: ["xonsh"],
    interpreters: ["pipx"],
  };
  expect(programFor("mytool-dev", file).name).toBe("My Tool");
  expect(programFor("xonsh", file).id).toBe("shell");
  expect(programFor("pipx run vitest", file).id).toBe("vitest");
  const claude = programTable(file).find((p) => p.id === "claude")!;
  expect(claude).toMatchObject({ name: "Claude", tile: "#d97757", run: ["my-claude"] }); // only `run` changed
  expect(programTable(file).find((p) => p.id === "lazygit")).toMatchObject({ name: "Git UI", tile: "#000000" });
});
