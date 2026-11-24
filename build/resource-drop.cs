using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Windows.Forms;

internal sealed class DropForm : Form
{
    private readonly string projectId;
    private readonly int port;
    private readonly string category;
    private readonly List<string> paths = new List<string>();
    private readonly ListBox listBox;
    private readonly Label status;
    private readonly Button okButton;

    public DropForm(string projectId, int port, string category)
    {
        this.projectId = projectId;
        this.port = port;
        this.category = category;

        var label = category == "repo" ? "项目库" : category == "note" ? "笔记" : "文献";
        Text = "添加" + label + " · 科研日志";
        ClientSize = new Size(470, 330);
        StartPosition = FormStartPosition.CenterScreen;
        TopMost = true;
        ShowInTaskbar = false;
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        MinimizeBox = false;
        BackColor = Color.FromArgb(250, 248, 243);
        Font = new Font("Microsoft YaHei UI", 9f);

        var title = new Label
        {
            Text = category == "note" ? "把 Markdown 文件拖到这里" : "把文件夹或文件拖到这里",
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            Font = new Font("Microsoft YaHei UI", 12.5f, FontStyle.Bold),
            ForeColor = Color.FromArgb(45, 95, 139),
        };
        var hint = new Label
        {
            Text = "挂到当前项目的「" + label + "」；可以一次拖多个。",
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = Color.FromArgb(120, 115, 105),
        };
        listBox = new ListBox
        {
            Dock = DockStyle.Fill,
            BorderStyle = BorderStyle.FixedSingle,
            IntegralHeight = false,
            AllowDrop = true,
        };
        status = new Label
        {
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft,
            ForeColor = Color.FromArgb(120, 115, 105),
        };

        var buttons = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.RightToLeft,
            Padding = new Padding(0, 6, 0, 0),
        };
        okButton = new Button { Text = "添加", Width = 82, Height = 30, Enabled = false };
        okButton.Click += (sender, e) => Submit();
        var cancel = new Button { Text = "取消", Width = 82, Height = 30 };
        cancel.Click += (sender, e) => Close();
        buttons.Controls.Add(cancel);
        buttons.Controls.Add(okButton);

        var table = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 5,
            Padding = new Padding(16, 14, 16, 12),
        };
        table.RowStyles.Add(new RowStyle(SizeType.Absolute, 46));
        table.RowStyles.Add(new RowStyle(SizeType.Absolute, 26));
        table.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        table.RowStyles.Add(new RowStyle(SizeType.Absolute, 46));
        table.RowStyles.Add(new RowStyle(SizeType.Absolute, 24));
        table.Controls.Add(title, 0, 0);
        table.Controls.Add(hint, 0, 1);
        table.Controls.Add(listBox, 0, 2);
        table.Controls.Add(buttons, 0, 3);
        table.Controls.Add(status, 0, 4);
        Controls.Add(table);

        WireDrop(this);
        WireDrop(listBox);
        AcceptButton = okButton;
        CancelButton = cancel;
    }

    private void WireDrop(Control control)
    {
        control.AllowDrop = true;
        control.DragEnter += (sender, e) =>
        {
            if (e.Data.GetDataPresent(DataFormats.FileDrop))
            {
                e.Effect = DragDropEffects.Copy;
            }
        };
        control.DragDrop += (sender, e) => HandleDrop(e);
    }

    private void HandleDrop(DragEventArgs e)
    {
        if (!e.Data.GetDataPresent(DataFormats.FileDrop))
        {
            return;
        }
        var items = (string[])e.Data.GetData(DataFormats.FileDrop);
        foreach (var item in items)
        {
            if (!paths.Contains(item))
            {
                paths.Add(item);
                listBox.Items.Add(item);
            }
        }
        okButton.Enabled = paths.Count > 0;
        status.Text = "已接收 " + paths.Count + " 项";
    }

    private void Submit()
    {
        if (paths.Count == 0)
        {
            status.Text = "还没有拖入任何文件夹或文件";
            return;
        }
        okButton.Enabled = false;
        status.Text = "正在添加…";

        var body = "{\"projectId\":" + Json(projectId) + ",\"category\":" + Json(category) + ",\"paths\":[" + string.Join(",", paths.ConvertAll(Json).ToArray()) + "]}";
        try
        {
            var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/api/resources/add");
            request.Method = "POST";
            request.ContentType = "application/json; charset=utf-8";
            request.Timeout = 15000;
            var bytes = Encoding.UTF8.GetBytes(body);
            request.ContentLength = bytes.Length;
            using (var stream = request.GetRequestStream())
            {
                stream.Write(bytes, 0, bytes.Length);
            }
            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
            {
                var text = reader.ReadToEnd();
                if (text.IndexOf("\"ok\": true", StringComparison.Ordinal) >= 0 ||
                    text.IndexOf("\"ok\":true", StringComparison.Ordinal) >= 0)
                {
                    DialogResult = DialogResult.OK;
                    Close();
                    return;
                }
                status.Text = "服务器没有确认，请重试";
            }
        }
        catch (Exception error)
        {
            status.Text = "添加失败：" + error.Message;
        }
        okButton.Enabled = true;
    }

    private static string Json(string value)
    {
        var builder = new StringBuilder("\"");
        foreach (var ch in value)
        {
            switch (ch)
            {
                case '\\': builder.Append("\\\\"); break;
                case '"': builder.Append("\\\""); break;
                case '\n': builder.Append("\\n"); break;
                case '\r': builder.Append("\\r"); break;
                case '\t': builder.Append("\\t"); break;
                default: builder.Append(ch); break;
            }
        }
        builder.Append("\"");
        return builder.ToString();
    }
}

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        string project = null;
        var port = 47823;
        var category = "ref";
        for (var i = 0; i + 1 < args.Length; i++)
        {
            if (args[i] == "--project") project = args[i + 1];
            else if (args[i] == "--port") int.TryParse(args[i + 1], out port);
            else if (args[i] == "--category") category = args[i + 1];
        }
        if (string.IsNullOrEmpty(project))
        {
            MessageBox.Show("缺少项目参数，请从科研日志里点“添加资料”。", "科研日志", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new DropForm(project, port, category));
    }
}
