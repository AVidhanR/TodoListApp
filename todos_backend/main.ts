import { Application, Router } from "@oakserver/oak";
import { Context } from "node:vm";
import { z } from "zod";

const TodoSchema = z.object({
  text: z.string(),
  completed: z.boolean().default(false),
  createdAt: z.date().default(() => new Date()),
});
type Todo = z.infer<typeof TodoSchema>;

const router = new Router();
const db = await Deno.openKv();
const application = new Application();
const port = 9000;

router.post("/post-todos", async (ctx: Context) => {
  try {
    const result = await ctx.request.body.json();
    console.log(result);

    if (!result || typeof result != "object") {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "invalid todo data",
        details: "Somethings wrong with the sent data",
      };
      return;
    }

    const newTodo: Todo = result;
    const id = crypto.randomUUID();
    await db.set(["todos", id], newTodo);

    ctx.response.status = 201;
    ctx.response.body = { id, ...newTodo };
  } catch (e) {
    console.error("Error in /post-todos", e);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to create todo" };
  }
});

router.get("/get-todos", async (ctx: Context) => {
  const todos: Record<string, Todo> = {};

  const entries = db.list({ prefix: ["todos"] });

  for await (const entry of entries) {
    todos[entry.key[1] as string] = entry.value as Todo;
  }

  ctx.response.body = Object.entries(todos).map(([id, todo]) => {
    return { id, ...todo };
  });
});

router.delete("/delete-todos/:id", async (ctx: Context) => {
  const id = ctx.params.id;
  await db.delete(["todos", id]);

  if (!id) {
    ctx.response.status = 400;
    ctx.response.body = { error: `Cannot delete the todo id ${id}` };
    return;
  }

  ctx.response.status = 200;
  ctx.response.body = {
    success: true,
    messsage: `Todo with id: ${id} deleted successfully`,
  };
});

router.delete("/delete-all-todos", async (ctx: Context) => {
  try {
    await db.delete(["todos"]);
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: `All todos deleted successfully`,
    };
  } catch (error) {
    console.error("Error deleting todos:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Failed to delete todos",
    };
  }
});

router.get("/", (ctx: Context) => {
  ctx.response.body = "Hello, World!";
});

application.use(async (ctx, next) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  await next();
});

application.use(router.routes());
application.use(router.allowedMethods());
console.log(`Server listening on port: ${port}`);
await application.listen({ port: port });
