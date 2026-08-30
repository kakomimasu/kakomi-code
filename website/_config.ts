import lume from "lume/mod.ts";
import basePath from "lume/plugins/base_path.ts";
import tailwindcss from "lume/plugins/tailwindcss.ts";

const site = lume({
  src: "./src",
  dest: "./dist",
  location: new URL("https://code.kakomimasu.com/"),
});

site.use(tailwindcss());
site.use(basePath());
site.add("styles.css");
site.add("assets", ".");
site.add(".nojekyll");

export default site;
