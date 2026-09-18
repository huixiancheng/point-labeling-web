using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace PointLabelerLauncher
{
    internal sealed class LauncherForm : Form
    {
        private readonly string packageRoot;
        private readonly Button startButton;
        private readonly Button stopButton;
        private readonly Button updateButton;
        private readonly Button hideTrayButton;
        private readonly Button exitButton;
        private readonly Label statusLabel;
        private readonly TextBox portInput;
        private readonly ComboBox profileSelect;
        private readonly NotifyIcon trayIcon;
        private readonly ContextMenuStrip trayMenu;
        private bool busy;
        private bool shuttingDown;
        private bool suppressExitPrompt;
        private const int DefaultServerPort = 8090;
        private const string DefaultServerProfile = "auto";

        public LauncherForm()
        {
            packageRoot = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

            Text = "Point Labeler Launcher";
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = true;
            ClientSize = new Size(500, 330);
            Font = new Font("Microsoft YaHei UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            try
            {
                var applicationIcon = System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                if (applicationIcon != null) Icon = applicationIcon;
            }
            catch { }

            trayMenu = new ContextMenuStrip();
            var showTrayItem = new ToolStripMenuItem("显示启动器 / Show launcher");
            showTrayItem.Click += delegate { ShowLauncher(); };
            var startTrayItem = new ToolStripMenuItem("开启标注 / Start annotation");
            startTrayItem.Click += delegate { StartAnnotation(); };
            var stopTrayItem = new ToolStripMenuItem("结束标注 / Stop annotation");
            stopTrayItem.Click += delegate { StopAnnotation(); };
            var hideTrayItem = new ToolStripMenuItem("隐藏到托盘 / Hide to tray");
            hideTrayItem.Click += delegate { HideToTray(); };
            var exitTrayItem = new ToolStripMenuItem("退出程序 / Exit");
            exitTrayItem.Click += delegate { ExitFromTray(); };
            trayMenu.Items.Add(showTrayItem);
            trayMenu.Items.Add(startTrayItem);
            trayMenu.Items.Add(stopTrayItem);
            trayMenu.Items.Add(hideTrayItem);
            trayMenu.Items.Add(new ToolStripSeparator());
            trayMenu.Items.Add(exitTrayItem);

            trayIcon = new NotifyIcon();
            trayIcon.Text = "点云标注 / Point Labeler";
            trayIcon.Icon = Icon ?? SystemIcons.Application;
            trayIcon.ContextMenuStrip = trayMenu;
            trayIcon.Visible = true;
            trayIcon.MouseClick += delegate(object sender, MouseEventArgs e)
            {
                if (e.Button == MouseButtons.Left) ShowLauncher();
            };
            trayIcon.DoubleClick += delegate { ShowLauncher(); };

            var title = new Label();
            title.AutoSize = true;
            title.Font = new Font(title.Font, FontStyle.Bold);
            title.Text = "点云标注 / Point Labeler";
            title.Location = new Point(24, 18);

            var subtitle = new Label();
            subtitle.AutoSize = true;
            subtitle.Text = "选择一个操作。程序和数据保持在当前发布包内。";
            subtitle.Location = new Point(24, 48);

            var url = new Label();
            url.AutoSize = true;
            url.ForeColor = Color.DimGray;
            url.Text = "默认地址: http://localhost:8090/（端口可调整）";
            url.Location = new Point(24, 72);

            var portLabel = new Label();
            portLabel.AutoSize = true;
            portLabel.Text = "端口 / Port";
            portLabel.Location = new Point(24, 98);

            portInput = new TextBox();
            portInput.Location = new Point(92, 94);
            portInput.Size = new Size(82, 24);
            portInput.Text = DefaultServerPort.ToString();

            var profileLabel = new Label();
            profileLabel.AutoSize = true;
            profileLabel.Text = "性能 / Profile";
            profileLabel.Location = new Point(205, 98);

            profileSelect = new ComboBox();
            profileSelect.DropDownStyle = ComboBoxStyle.DropDownList;
            profileSelect.Location = new Point(276, 94);
            profileSelect.Size = new Size(176, 24);
            profileSelect.Items.AddRange(new object[] { "auto", "high", "low" });
            profileSelect.SelectedIndex = 0;

            startButton = CreateActionButton("开启标注\nStart annotation");
            stopButton = CreateActionButton("结束标注\nStop annotation");
            updateButton = CreateActionButton("更新\nUpdate");
            hideTrayButton = CreateActionButton("隐藏到托盘\nHide to tray");
            hideTrayButton.Dock = DockStyle.None;
            hideTrayButton.Location = new Point(24, 248);
            hideTrayButton.Size = new Size(452, 28);
            exitButton = CreateActionButton("退出程序\nExit");

            startButton.Click += delegate { StartAnnotation(); };
            stopButton.Click += delegate { StopAnnotation(); };
            updateButton.Click += delegate { UpdatePackage(); };
            hideTrayButton.Click += delegate { HideToTray(); };
            exitButton.Click += delegate { Close(); };
            FormClosing += delegate(object sender, FormClosingEventArgs e) { HandleFormClosing(e); };

            var actions = new TableLayoutPanel();
            actions.ColumnCount = 2;
            actions.RowCount = 2;
            actions.Location = new Point(24, 130);
            actions.Size = new Size(452, 112);
            actions.Padding = new Padding(0);
            actions.Margin = new Padding(0);
            actions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));
            actions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));
            actions.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));
            actions.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));
            actions.Controls.Add(startButton, 0, 0);
            actions.Controls.Add(stopButton, 1, 0);
            actions.Controls.Add(updateButton, 0, 1);
            actions.Controls.Add(exitButton, 1, 1);

            statusLabel = new Label();
            statusLabel.AutoSize = false;
            statusLabel.BorderStyle = BorderStyle.Fixed3D;
            statusLabel.TextAlign = ContentAlignment.MiddleLeft;
            statusLabel.Text = "就绪 / Ready";
            statusLabel.Location = new Point(24, 284);
            statusLabel.Size = new Size(452, 28);
            statusLabel.Padding = new Padding(6, 0, 6, 0);

            Resize += delegate
            {
                if (WindowState == FormWindowState.Minimized)
                {
                    // Keep the normal taskbar restore entry. The tray icon is
                    // still available for quick actions, but hiding the only
                    // window can leave some Windows shells with no restore
                    // target after a minimize transition.
                    ShowInTaskbar = true;
                }
            };
            FormClosed += delegate
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
                trayMenu.Dispose();
            };

            Controls.Add(title);
            Controls.Add(subtitle);
            Controls.Add(url);
            Controls.Add(portLabel);
            Controls.Add(portInput);
            Controls.Add(profileLabel);
            Controls.Add(profileSelect);
            Controls.Add(actions);
            Controls.Add(hideTrayButton);
            Controls.Add(statusLabel);
        }

        private void ShowLauncher()
        {
            ShowInTaskbar = true;
            WindowState = FormWindowState.Normal;
            if (!Visible) Show();
            BringToFront();
            Activate();
        }

        private void ExitFromTray()
        {
            if (!Visible) ShowLauncher();
            Close();
        }

        private void HideToTray()
        {
            if (busy) return;
            ShowInTaskbar = false;
            Hide();
        }

        private bool ConfirmServiceStop(string actionZh, string actionEn)
        {
            if (suppressExitPrompt || CountPackageServers() == 0) return true;
            if (!Visible) ShowLauncher();
            var choice = MessageBox.Show(this,
                "网页中可能还有未保存的标签修改。请先确认网页顶部显示“0 个待保存”。\n\n确定要" + actionZh + "吗？\n\nThe browser may contain unsaved label changes. Confirm that it shows 0 pending before you " + actionEn + ".",
                "未保存修改 / Unsaved changes",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning,
                MessageBoxDefaultButton.Button2);
            return choice == DialogResult.Yes;
        }

        private static Button CreateActionButton(string text)
        {
            var button = new Button();
            button.Dock = DockStyle.Fill;
            button.Margin = new Padding(4);
            button.Text = text;
            button.TextAlign = ContentAlignment.MiddleCenter;
            button.UseVisualStyleBackColor = true;
            return button;
        }

        private string AppPath(string fileName)
        {
            return Path.Combine(packageRoot, "app", fileName);
        }

        private string DataRootPath()
        {
            return Path.Combine(packageRoot, "clips");
        }

        private string ServerPath()
        {
            return AppPath("point_labeler_server.exe");
        }

        private string AssetsPath()
        {
            return AppPath("assets");
        }

        private string WebRootPath()
        {
            return AppPath("web");
        }

        private string LogPath()
        {
            return Path.Combine(packageRoot, "logs", "server.log");
        }

        private string RootPath(string fileName)
        {
            return Path.Combine(packageRoot, fileName);
        }

        private static string Quote(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }

        private int SelectedPort()
        {
            int port;
            if (!int.TryParse(portInput.Text.Trim(), out port) || port < 1 || port > 65535)
            {
                throw new InvalidOperationException("端口必须是 1–65535 之间的数字 / Port must be between 1 and 65535");
            }
            return port;
        }

        private string SelectedProfile()
        {
            var profile = profileSelect.SelectedItem == null ? DefaultServerProfile : profileSelect.SelectedItem.ToString();
            if (profile != "auto" && profile != "high" && profile != "low")
            {
                throw new InvalidOperationException("性能模式无效 / Invalid performance profile");
            }
            return profile;
        }

        private static string BrowserUrl(int port, string profile)
        {
            return "http://localhost:" + port + "/?profile=" + profile;
        }

        private void SetBusy(bool value, string status)
        {
            busy = value;
            startButton.Enabled = !value;
            stopButton.Enabled = !value;
            updateButton.Enabled = !value;
            hideTrayButton.Enabled = !value;
            exitButton.Enabled = !value;
            statusLabel.Text = status;
            Application.DoEvents();
        }

        private void HandleFormClosing(FormClosingEventArgs e)
        {
            if (busy)
            {
                e.Cancel = true;
                statusLabel.Text = "当前操作尚未完成 / Please wait for the current operation to finish";
                return;
            }
            if (e.CloseReason != CloseReason.WindowsShutDown &&
                !ConfirmServiceStop("退出启动器并结束当前服务", "exit the launcher and stop the current service"))
            {
                e.Cancel = true;
                return;
            }
            if (shuttingDown) return;
            shuttingDown = true;
            try
            {
                var stopped = StopPackageServers();
                if (stopped > 0)
                {
                    statusLabel.Text = "已退出并结束当前包服务 / Exited and stopped this package service";
                }
            }
            catch { }
        }

        private static bool SamePath(string left, string right)
        {
            try
            {
                var normalizedLeft = Path.GetFullPath(left).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                var normalizedRight = Path.GetFullPath(right).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                return string.Equals(normalizedLeft, normalizedRight, StringComparison.OrdinalIgnoreCase);
            }
            catch { return false; }
        }

        private static string TryGetExecutablePath(Process process)
        {
            try { return process.MainModule.FileName; }
            catch { return null; }
        }

        private int CountPackageServers()
        {
            var target = Path.GetFullPath(ServerPath());
            var count = 0;
            foreach (var process in Process.GetProcessesByName("point_labeler_server"))
            {
                try
                {
                    var executablePath = TryGetExecutablePath(process);
                    if (!string.IsNullOrWhiteSpace(executablePath) && SamePath(executablePath, target)) count++;
                }
                finally { process.Dispose(); }
            }
            return count;
        }

        private int StopPackageServers()
        {
            var target = Path.GetFullPath(ServerPath());
            var stopped = 0;
            foreach (var process in Process.GetProcessesByName("point_labeler_server"))
            {
                try
                {
                    var executablePath = TryGetExecutablePath(process);
                    if (string.IsNullOrWhiteSpace(executablePath) || !SamePath(executablePath, target)) continue;
                    if (!process.HasExited)
                    {
                        process.Kill();
                        if (!process.WaitForExit(5000))
                        {
                            throw new InvalidOperationException("服务进程未能在规定时间内退出 / Server did not exit in time");
                        }
                        stopped++;
                    }
                }
                finally { process.Dispose(); }
            }
            return stopped;
        }

        private Process StartPackageServer(int port)
        {
            var serverPath = ServerPath();
            var assetsPath = AssetsPath();
            var webRootPath = WebRootPath();
            var dataRootPath = DataRootPath();
            var logPath = LogPath();

            foreach (var path in new[] { serverPath, assetsPath, webRootPath })
            {
                if (!File.Exists(path) && !Directory.Exists(path))
                {
                    throw new FileNotFoundException("发布包文件缺失 / Package file is missing", path);
                }
            }
            Directory.CreateDirectory(dataRootPath);
            Directory.CreateDirectory(Path.GetDirectoryName(logPath));

            var info = new ProcessStartInfo();
            info.FileName = serverPath;
            info.Arguments = "--root " + Quote(dataRootPath)
                + " --assets " + Quote(assetsPath)
                + " --web-root " + Quote(webRootPath)
                + " --log " + Quote(logPath)
                + " --host 127.0.0.1 --port " + port;
            info.WorkingDirectory = Path.GetDirectoryName(serverPath);
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.WindowStyle = ProcessWindowStyle.Hidden;

            var process = Process.Start(info);
            if (process == null) throw new InvalidOperationException("无法启动服务进程 / Could not start server process");
            Thread.Sleep(250);
            if (process.HasExited)
            {
                var exitCode = process.ExitCode;
                process.Dispose();
                throw new InvalidOperationException("服务进程立即退出，退出码 " + exitCode + "；请查看 logs/server.log / Server exited immediately; check logs/server.log");
            }
            return process;
        }

        private static bool WaitForServer(int port, int timeoutMilliseconds)
        {
            var deadline = DateTime.UtcNow.AddMilliseconds(timeoutMilliseconds);
            while (DateTime.UtcNow < deadline)
            {
                try
                {
                    var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/api/health");
                    request.Timeout = 300;
                    request.ReadWriteTimeout = 300;
                    using (var response = (HttpWebResponse)request.GetResponse())
                    {
                        if ((int)response.StatusCode >= 200 && (int)response.StatusCode < 300) return true;
                    }
                }
                catch { }
                Thread.Sleep(150);
            }
            return false;
        }

        private static void OpenBrowser(string url)
        {
            var info = new ProcessStartInfo();
            info.FileName = url;
            info.UseShellExecute = true;
            Process.Start(info);
        }

        private static void SyncDirectory(string source, string target)
        {
            Directory.CreateDirectory(target);
            foreach (var sourceFile in Directory.GetFiles(source))
            {
                var targetFile = Path.Combine(target, Path.GetFileName(sourceFile));
                File.Copy(sourceFile, targetFile, true);
            }
            foreach (var targetFile in Directory.GetFiles(target))
            {
                var sourceFile = Path.Combine(source, Path.GetFileName(targetFile));
                if (!File.Exists(sourceFile)) File.Delete(targetFile);
            }
            foreach (var sourceDirectory in Directory.GetDirectories(source))
            {
                var targetDirectory = Path.Combine(target, Path.GetFileName(sourceDirectory));
                SyncDirectory(sourceDirectory, targetDirectory);
            }
            foreach (var targetDirectory in Directory.GetDirectories(target))
            {
                var sourceDirectory = Path.Combine(source, Path.GetFileName(targetDirectory));
                if (!Directory.Exists(sourceDirectory)) Directory.Delete(targetDirectory, true);
            }
        }

        private static void ValidateUpdateDirectory(string path)
        {
            if (!Directory.Exists(path)) throw new DirectoryNotFoundException("更新目录不存在 / Update directory not found: " + path);
            if (!File.Exists(Path.Combine(path, "point_labeler_server.exe")) ||
                !Directory.Exists(Path.Combine(path, "assets")) ||
                !Directory.Exists(Path.Combine(path, "web")))
            {
                throw new InvalidOperationException("更新包缺少 point_labeler_server.exe、assets 或 web / Update package is incomplete");
            }
        }

        private void ReplaceAppWithUpdate(string source)
        {
            var target = RootPath("app");
            var staging = RootPath("update\\.app-staging");
            var backup = RootPath("update\\.app-backup");
            if (Directory.Exists(staging)) Directory.Delete(staging, true);
            if (Directory.Exists(backup)) Directory.Delete(backup, true);

            SyncDirectory(source, staging);
            ValidateUpdateDirectory(staging);
            if (Directory.Exists(target)) Directory.Move(target, backup);
            try
            {
                Directory.Move(staging, target);
            }
            catch
            {
                if (!Directory.Exists(target) && Directory.Exists(backup)) Directory.Move(backup, target);
                throw;
            }
            try
            {
                if (Directory.Exists(backup)) Directory.Delete(backup, true);
            }
            catch { }
        }

        private void StartAnnotation()
        {
            if (busy) return;
            int port;
            string profile;
            try
            {
                port = SelectedPort();
                profile = SelectedProfile();
            }
            catch (Exception error)
            {
                statusLabel.Text = "启动参数无效 / Invalid start settings: " + error.Message;
                return;
            }
            SetBusy(true, "正在开启标注… / Starting annotation…");
            try
            {
                var packageServerCount = CountPackageServers();
                var portReady = WaitForServer(port, 500);
                if (packageServerCount > 0 && portReady)
                {
                    OpenBrowser(BrowserUrl(port, profile));
                    statusLabel.Text = "标注服务已经运行 / Annotation service is already running";
                }
                else
                {
                    // If this package is already running on another configured port,
                    // stop only this package's exact executable before starting the
                    // requested port. This avoids opening a dead browser URL.
                    if (CountPackageServers() > 0)
                    {
                        StopPackageServers();
                        Thread.Sleep(150);
                    }
                    if (WaitForServer(port, 500))
                    {
                        throw new InvalidOperationException("目标端口已被其他服务占用，请更换端口 / The selected port is already used by another service");
                    }
                    using (var process = StartPackageServer(port))
                    {
                        var ready = WaitForServer(port, 8000);
                        if (process.HasExited || CountPackageServers() == 0)
                        {
                            var exitCode = process.HasExited ? process.ExitCode.ToString() : "unknown";
                            throw new InvalidOperationException("本包服务未能监听目标端口，退出码 " + exitCode + "；请查看 logs/server.log / This package could not bind the selected port; check logs/server.log");
                        }
                        if (!ready)
                        {
                            statusLabel.Text = "服务进程已启动但尚未响应，请查看 logs/server.log / Server started but is not ready; check logs/server.log";
                            return;
                        }
                        OpenBrowser(BrowserUrl(port, profile));
                        statusLabel.Text = "标注服务已启动，浏览器正在打开 / Annotation service started";
                    }
                }
            }
            catch (Exception error)
            {
                statusLabel.Text = "启动失败 / Start failed: " + error.Message;
            }
            finally
            {
                SetBusy(false, statusLabel.Text);
            }
        }

        private void StopAnnotation()
        {
            if (busy) return;
            if (!ConfirmServiceStop("结束当前服务", "stop the current service")) return;
            SetBusy(true, "正在结束标注… / Stopping annotation…");
            try
            {
                var stopped = StopPackageServers();
                statusLabel.Text = stopped > 0
                    ? "标注服务已结束 / Annotation service stopped"
                    : "没有发现当前包正在运行的服务 / No service from this package was running";
            }
            catch (Exception error)
            {
                statusLabel.Text = "结束失败 / Stop failed: " + error.Message;
            }
            finally
            {
                SetBusy(false, statusLabel.Text);
            }
        }

        private void UpdatePackage()
        {
            if (busy) return;
            var source = Path.Combine(packageRoot, "update", "app");
            if (!Directory.Exists(source))
            {
                MessageBox.Show(this,
                    "没有找到 update\\app。请先解压新版本的 app 到 update 目录。\n\nNew app folder was not found under update\\app.",
                    "更新 / Update", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            SetBusy(true, "正在更新… / Updating…");
            try
            {
                StopPackageServers();
                ValidateUpdateDirectory(source);
                ReplaceAppWithUpdate(source);
                var launcherUpdate = RootPath("update\\PointLabelerLauncher.exe");
                if (File.Exists(launcherUpdate))
                {
                    suppressExitPrompt = true;
                    ScheduleLauncherUpdate(launcherUpdate);
                    statusLabel.Text = "更新完成，正在替换启动器 / Update completed; replacing launcher";
                    BeginInvoke((MethodInvoker)delegate { Close(); });
                }
                else
                {
                    statusLabel.Text = "更新完成，请重新开启标注 / Update completed; start annotation again";
                }
            }
            catch (Exception error)
            {
                statusLabel.Text = "更新失败 / Update failed: " + error.Message;
            }
            finally
            {
                SetBusy(false, statusLabel.Text);
            }
        }

        private void ScheduleLauncherUpdate(string source)
        {
            var helper = RootPath(".point_labeler_launcher_updater.exe");
            if (File.Exists(helper)) File.Delete(helper);
            File.Copy(Application.ExecutablePath, helper, true);
            var info = new ProcessStartInfo();
            info.FileName = helper;
            info.Arguments = "--apply-launcher-update " + Program.QuoteArgument(source)
                + " " + Program.QuoteArgument(Application.ExecutablePath)
                + " " + Process.GetCurrentProcess().Id;
            info.WorkingDirectory = packageRoot;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.WindowStyle = ProcessWindowStyle.Hidden;
            Process.Start(info);
        }
    }

    internal static class Program
    {
        private const string LauncherMutexName = "Local\\PointLabelerWebWinOpenLauncher";

        internal static string QuoteArgument(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }

        private static int ApplyLauncherUpdate(string[] args)
        {
            if (args.Length < 4) return 2;
            var source = args[1];
            var target = args[2];
            int parentId;
            if (!File.Exists(source) || !int.TryParse(args[3], out parentId)) return 2;

            try
            {
                using (var parent = Process.GetProcessById(parentId)) { parent.WaitForExit(15000); }
            }
            catch { }
            Thread.Sleep(300);

            var replaced = false;
            for (var attempt = 0; attempt < 24 && !replaced; attempt++)
            {
                try
                {
                    File.Copy(source, target, true);
                    replaced = true;
                }
                catch { Thread.Sleep(250); }
            }
            if (!replaced) return 1;

            try
            {
                var start = new ProcessStartInfo();
                start.FileName = target;
                start.WorkingDirectory = Path.GetDirectoryName(target);
                start.UseShellExecute = true;
                Process.Start(start);
            }
            catch { return 1; }

            ScheduleSelfDelete(Application.ExecutablePath);
            return 0;
        }

        private static void ScheduleSelfDelete(string path)
        {
            var commandShell = Environment.GetEnvironmentVariable("ComSpec");
            if (string.IsNullOrWhiteSpace(commandShell)) return;
            try
            {
                var cleanup = new ProcessStartInfo();
                cleanup.FileName = commandShell;
                cleanup.Arguments = "/c ping 127.0.0.1 -n 2 >nul & del /f /q " + QuoteArgument(path);
                cleanup.UseShellExecute = false;
                cleanup.CreateNoWindow = true;
                cleanup.WindowStyle = ProcessWindowStyle.Hidden;
                Process.Start(cleanup);
            }
            catch { }
        }

        [STAThread]
        private static void Main(string[] args)
        {
            if (args.Length > 0 && args[0].Equals("--apply-launcher-update", StringComparison.OrdinalIgnoreCase))
            {
                Environment.ExitCode = ApplyLauncherUpdate(args);
                return;
            }
            bool createdNew;
            using (var launcherMutex = new Mutex(true, LauncherMutexName, out createdNew))
            {
                if (!createdNew)
                {
                    MessageBox.Show("已有一个点云标注启动器在运行。\n\nAnother Point Labeler Launcher is already running.",
                        "Point Labeler Launcher", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new LauncherForm());
            }
        }
    }
}
