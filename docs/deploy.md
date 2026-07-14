# 部署指南

## 前提准备

### 1. 创建内容仓库

在 GitHub 上创建一个新仓库用于存储书籍数据（建议**私有**）。

记下仓库的 `owner`（用户名）和 `repo`（仓库名），后面需要填入。

### 2. 创建 GitHub Token

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens**
2. Generate new token
3. Resource owner：选择你的账号
4. Repository access：选择 **Only select repositories**，勾选你的**内容仓库**
5. Permissions 设置以下权限：

| 权限      | 级别           | 用途                           |
| --------- | -------------- | ------------------------------ |
| Contents  | Read and write | 创建 Release、读写 index.json  |
| Actions   | Read and write | 检查 Action 运行状态           |
| Workflows | Read and write | 触发工作流、写入 workflow 文件 |

6. 生成后**立即复制**，离开页面后无法再查看

### 3. 创建 Cloudflare 账号

注册 [Cloudflare](https://dash.cloudflare.com/sign-up)，验证邮箱。

### 4. 创建 Cloudflare 帐户 API 令牌

1. Cloudflare Dashboard → 管理账户 → 帐户 API 令牌 → 创建令牌，名称随意（如 `novel`）
2. 进入存储桶 → 设置 → R2 API 令牌 → 创建 API 令牌
3. 给予以下权限：
   - Workers R2 Storage Read
   - Workers R2 Storage Write
   - Workers Scripts Read
   - Workers Scripts Write
   - Account Settings Read
4. 点击审核令牌，正确示例如下：
   - 令牌摘要
     名称
     legado-shelf-deploy-token
     过期时间
     无过期时间
     权限策略
     整个 xxx's Account 账户
     Workers R2 Storage Read
     Workers R2 Storage Write
     Workers Scripts Read
     Workers Scripts Write
     Account Settings Read
5. 继续下一步创建令牌并记录下弹出的：
   - 账户 ID
   - API 令牌
   - 【S3 兼容凭证】访问密钥 ID
   - 【S3 兼容凭证】秘密访问密钥
   - 【S3 兼容凭证】S3 API 端点

## 开始部署

1. Fork [当前仓库](https://github.com/2061360308/legado-shelf)到自己账户

2. 进入 Fork 后的仓库，点击 Settings → Secrets and variables → Actions 添加如下仓库级别 变量(Repository variables) 和 密钥(Repository secrets)

   **环境变量-Repository variables**

   |       变量        | 是否必须 |                  来源                  |  默认值  |               说明               |
   | :---------------: | :------: | :------------------------------------: | :------: | :------------------------------: |
   |  `CONTENT_OWNER`  |    是    | [前提准备 1](#1-创建内容仓库) 中 owner |    无    |         内容仓库的 owner         |
   |  `CONTENT_REPO`   |    是    | [前提准备 1](#1-创建内容仓库) 中 repo  |    无    |            内容仓库名            |
   |    `SITE_URL`     |    否    |                   -                    |    无    | cloudfare 上为应用绑定的个人域名 |
   |    `CACHE_TTL`    |    否    |                   -                    |    15    |     Action 工作状态缓存时间      |
   | `MAX_UPLOAD_SIZE` |    否    |                   -                    | 52428800 | 上传文件大小的上限（默认 50MB）  |

   **密钥-Repository secrets**

   |          变量           | 是否必须 |                             来源                              |                       说明                       |
   | :---------------------: | :------: | :-----------------------------------------------------------: | :----------------------------------------------: |
   |        `API_KEY`        |    是    |                               -                               |               部署后访问站点的密码               |
   |        `GH_PAT`         |    是    |          [前提准备 2](#2-创建-github-token) 中 Token          | 拥有内容仓库访问权限的 github Fine-grained token |
   | `CLOUDFLARE_ACCOUNT_ID` |    是    |   [前提准备 4](#4-创建-cloudflare-帐户-api-令牌) 中 账户 ID   |                        -                         |
   | `CLOUDFLARE_API_TOKEN`  |    是    |  [前提准备 4](#4-创建-cloudflare-帐户-api-令牌) 中 API 令牌   |                        -                         |
   |      `R2_ENDPOINT`      |    是    | [前提准备 4](#4-创建-cloudflare-帐户-api-令牌) 中 S3 API 端点 |                        -                         |
   |   `R2_ACCESS_KEY_ID`    |    是    | [前提准备 4](#4-创建-cloudflare-帐户-api-令牌) 中 访问密钥 ID |                        -                         |
   | `R2_SECRET_ACCESS_KEY`  |    是    | [前提准备 4](#4-创建-cloudflare-帐户-api-令牌) 中 S3 API 端点 |                        -                         |

3. 进入 Fork 后的仓库，点击 Actions → Deploy → Run workflow（Branch main）启动部署工作流，等等部署完成
4. 【可选】回到 cloudfare 为 应用绑定个人域名，绑定后需要给仓库填写`SITE_URL`变量

## 后续干什么

项目提供了web管理面板与阅读书源供开箱使用，但也可以基于API自行拓展功能。具体使用说明见：[`使用说明`](./usage.md)。
