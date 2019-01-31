/**
 * git webhook handler
 * @author LeoEatle
 */
import { BaseContext } from "koa";
import ChatRobot from "./chat";
import { config } from "../config";
interface Repository {
    name: string;
    description: string;
    homepage: string;
    git_http_url: string;
    git_ssh_url: string;
    url: string;
    visibility_level: number;
}

interface Commit {
    id: string;
    message: string;
    timestamp: string;
    url: string;
    author: object;
    added: Array<any>;
    modified: Array<any>;
    removed: Array<any>;
}

interface User {
    name: string;
    username: string;
    avatar_url: string;
}

interface Source {
    name: string;
    ssh_url: string;
    http_url: string;
    web_url: string;
    namespace: string;
    visibility_level: number;
}

/**
 * 收到push通知时的http body
 */
interface PushBody {
    object_kind: string;
    before: string;
    after: string;
    ref: string;
    checkout_sha: string;
    user_name: string;
    user_id: number;
    user_email: string;
    project_id: number;
    repository: Repository;
    commits: Array<Commit>;
    total_commits_count: number;
}

interface MRBody {
    object_kind: string;
    user: User;
    object_attributes: {
        // 这里并不包括所有的object_attribute，因为实在太多了暂时只列出我们需要的几个属性
        id: number,
        target_branch: string,
        source_branch: string,
        title: string,
        created_at: string,
        updated_at: string,
        merge_status: string,
        description: string,
        url: string,
        source: Source,
        action: string // action 可能是open/update/close/reopen
    };
}

const HEADER_KEY: string = "x-event";

const EVENTS = {
    "Push Hook": "push",
    "Tag Push Hook": "tag_push",
    "Issue Hook": "issue",
    "Note Hook": "note",
    "Merge Request Hook": "merge_request",
    "Review Hook": "review"
};
export default class GitWebhookController {
    public static async getWebhook(ctx: BaseContext) {
        console.log("git webhook req", ctx.request);
        const event: string = ctx.request.header[HEADER_KEY];
        if (!event) {
            ctx.body = `Sorry，这可能不是一个gitlab的webhook请求`;
        }
        switch (EVENTS[event]) {
            case "push":
                return await GitWebhookController.handlePush(ctx);
            case "merge_request":
                return await GitWebhookController.handleMR(ctx);
            default:
                return await GitWebhookController.handleDefault(ctx, event);
        }
    }

    /**
     * 处理push事件
     * @param ctx koa context
     */
    public static async handlePush(ctx: BaseContext) {
        const body: PushBody = ctx.request.body;
        const robot: ChatRobot = new ChatRobot(
            config.chatid
        );
        let msg: String;
        console.log("http body", body);
        const { user_name, repository, commits, ref} = body;
        if (repository.name === "project_test" && user_name === "user_test") {
            msg = "收到一次webhook test";
            ctx.body = msg;
            return await robot.sendTextMsg(msg);
        } else {
            const lastCommit: Commit = commits[0];
            const branchName = ref.replace("refs/heads/", "");
            msg = `项目 ${repository.name} 收到了一次push，提交者：${user_name}，最新提交信息：${lastCommit.message}`;
            ctx.body = msg;
            const mdMsg = `项目 [${repository.name}](${repository.homepage}) 收到一次push提交
                           提交者:  \<font color= \"commit\"\>${user_name}\</font\>
                           分支:  \<font color= \"commit\"\>${branchName}\</font\>
                           最新提交信息: \<font color= \"comment\"\>${lastCommit.message}\</font\>`;
            return await robot.sendMdMsg(mdMsg);
        }
    }

    /**
     * 处理merge request事件
     * @param ctx koa context
     */
    public static async handleMR(ctx: BaseContext) {
        const body: MRBody = ctx.request.body;
        const robot: ChatRobot = new ChatRobot(
            config.chatid
        );
        console.log("mr http body", body);
        const actionWords = {
            "open": "发起",
            "close": "关闭",
            "reopen": "重新发起",
            "update": "更新"
        };
        const {user, object_attributes} = body;
        const attr = object_attributes;
        const mdMsg = `${user.name}在 [${attr.source.name}](${attr.source.web_url}) ${actionWords[attr.action]}了一个MR
                        标题：${attr.title}
                        [点此查看](${attr.url})`;
        return await robot.sendMdMsg(mdMsg);
    }

    public static handleDefault(ctx: BaseContext, event: String) {
        ctx.body = `Sorry，暂时还没有处理${event}事件`;
    }
}
