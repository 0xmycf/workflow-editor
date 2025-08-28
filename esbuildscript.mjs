import * as esbuild from "esbuild";
import {polyfillNode} from "esbuild-plugin-polyfill-node";

const watchMode = process.argv.includes("--watch");

const ctx = await esbuild.context({
    entryPoints: ["js/widget.ts"],
    minify: true,
    bundle: true,
    format: "esm",
    outdir: "dist",
    plugins: [polyfillNode()],
    sourcemap: watchMode ? "inline" : undefined
});
if (watchMode) {
    await ctx.watch();
} else {
    await ctx.rebuild();
    await ctx.dispose();
}