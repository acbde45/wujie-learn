## 调试代码

克隆代码后，运行以下脚本就可以在本地调试代码：

```bash
pnpm i                  // 安装包依赖，务必使用pnpm
npm run start           // 启动子应用
```

## Commit

对于如何提交 git commit message，我们有非常精确的规则。我们希望所有的 commit message 更具可读性，这样在查看项目历史记录会变得容易，同时我们使用 commit message 生成 Changelog.

本项目使用了 `@commitlint` 作为 commit lint 工具，并使用 [`@commitlint/config-conventional`](https://www.npmjs.com/package/@commitlint/config-conventional)作为校验规则.

### 提交格式

每个 commit message 包括 **header**, **body** 和 **footer**.

header 具有特殊的格式，包括 **type**, **scope** 和 **subject**, type 和 subject 是必须的，scope 是可选的。

```vim
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

提交 message 的任何行不能超过 100 个字符！确保 message 在 GitHub 以及各种 git 工具中更易于阅读。

注脚应该包含 [closing reference to an issue](https://help.github.com/articles/closing-issues-via-commit-messages/) 如果有的话.

示例:

```vim
docs(changelog): update change log to beta.5
```

```vim
fix(editor): resize error
Component doesn't refresh when resize it.
fix #123
```

### Type

必须是以下选项之一:

- **feat**: 一个新特性
- **fix**: 一次 bug 修复
- **docs**: 只是对文档进行修改
- **style**: 不影响代码本身含义的代码风格修改
- **refactor**: 既不属于新特性又不是 bug 修改的代码修改
- **perf**: 性能优化
- **test**: 添加或修改测试用例
- **build**: 修改构建工具
- **ci**: 修改自动化脚本
- **revert**: 回滚提交

### Scope

Scope 应该是本次修改所影响模块的名称（文件夹名称或其他有意义的单词）。

```vim
<prefix:name>
<prefix:name1,name2>
```

其他情况可以忽略 scope:

- 使用 `docs`, `build` 或 `ci` 等全局修改(例如:`docs: add missing type`).

### Subject

Subject 是本次修改的简洁描述:

- 使用祈使句、现在时，例如：使用 "change" 而不是 "changed"、"changes"
- 不大写第一个字母
- 不以小数点(.)结尾

### Body

Body 应包含修改的动机，并对比这与以前的行为，是本次修改的详细描述：

- 使用祈使句、现在时，例如：使用 "change" 而不是 "changed"、"changes"

### Footer

Footer 应包含 **Breaking Changes** 和关闭或关联的 **Issues**

- **Breaking Changes** 应该以 `BREAKING CHANGE:` 开头
- 关联的 **Issues** 使用 `issue #2`
- 关闭 **Issues** 使用 `close #2`
