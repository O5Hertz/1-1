import tkinter as tk
from tkinter import messagebox, ttk
import webbrowser
import json
import urllib.parse
import urllib.request
from io import BytesIO
from PIL import Image, ImageTk
import geocoder
import threading
import traceback
import time

class LocationImpressionsApp:
    def __init__(self, root):
        self.root = root
        self.root.title("位置印象可视化 - fluxschnellv2版")
        self.root.geometry("1000x700")
        
        # 主框架
        self.main_frame = ttk.Frame(root, padding="10")
        self.main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 位置获取部分
        self.location_frame = ttk.LabelFrame(self.main_frame, text="位置信息", padding="10")
        self.location_frame.pack(fill=tk.X, pady=5)
        
        self.location_label = ttk.Label(self.location_frame, text="当前位置:")
        self.location_label.grid(row=0, column=0, sticky=tk.W)
        
        self.location_entry = ttk.Entry(self.location_frame, width=50)
        self.location_entry.grid(row=0, column=1, padx=5)
        
        self.get_location_btn = ttk.Button(
            self.location_frame, 
            text="获取当前位置", 
            command=self.get_current_location
        )
        self.get_location_btn.grid(row=0, column=2, padx=5)
        
        # 手动输入位置
        self.manual_location_label = ttk.Label(self.location_frame, text="或手动输入位置:")
        self.manual_location_label.grid(row=1, column=0, sticky=tk.W, pady=(10, 0))
        
        self.manual_location_entry = ttk.Entry(self.location_frame, width=50)
        self.manual_location_entry.grid(row=1, column=1, padx=5, pady=(10, 0))
        
        # API调试信息
        self.debug_frame = ttk.LabelFrame(self.main_frame, text="API调试信息", padding="10")
        self.debug_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        self.debug_text = tk.Text(
            self.debug_frame, 
            height=10, 
            wrap=tk.WORD,
            state=tk.NORMAL
        )
        self.debug_text.pack(fill=tk.BOTH, expand=True)
        
        # 添加滚动条
        scrollbar = ttk.Scrollbar(self.debug_text)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.debug_text.config(yscrollcommand=scrollbar.set)
        scrollbar.config(command=self.debug_text.yview)
        
        # AI印象部分
        self.impression_frame = ttk.LabelFrame(self.main_frame, text="AI印象", padding="10")
        self.impression_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        self.impression_text = tk.Text(
            self.impression_frame, 
            height=10, 
            wrap=tk.WORD,
            state=tk.DISABLED
        )
        self.impression_text.pack(fill=tk.BOTH, expand=True)
        
        # 图片生成部分
        self.image_frame = ttk.LabelFrame(self.main_frame, text="生成的图片", padding="10")
        self.image_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        self.canvas = tk.Canvas(self.image_frame, bg='white')
        self.canvas.pack(fill=tk.BOTH, expand=True)
        
        # 控制按钮
        self.control_frame = ttk.Frame(self.main_frame)
        self.control_frame.pack(fill=tk.X, pady=5)
        
        self.get_impression_btn = ttk.Button(
            self.control_frame, 
            text="获取AI印象", 
            command=self.get_ai_impression,
            state=tk.DISABLED
        )
        self.get_impression_btn.pack(side=tk.LEFT, padx=5)
        
        self.generate_image_btn = ttk.Button(
            self.control_frame, 
            text="生成印象图片", 
            command=self.generate_image,
            state=tk.DISABLED
        )
        self.generate_image_btn.pack(side=tk.LEFT, padx=5)
        
        self.debug_btn = ttk.Button(
            self.control_frame,
            text="查看API请求",
            command=self.show_api_debug_info
        )
        self.debug_btn.pack(side=tk.LEFT, padx=5)
        
        # 状态栏
        self.status_var = tk.StringVar()
        self.status_bar = ttk.Label(
            root, 
            textvariable=self.status_var,
            relief=tk.SUNKEN,
            anchor=tk.W
        )
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)
        
        self.update_status("准备就绪")
        
        # 存储数据
        self.current_location = None
        self.ai_impression = None
        self.image_urls = []
        self.current_image_index = 0
        self.image_references = []  # 保持对图像的引用
        self.last_api_request = ""
        self.last_api_response = ""
    
    def update_status(self, message):
        self.status_var.set(message)
        self.root.update_idletasks()
    
    def log_debug_info(self, message):
        """记录调试信息"""
        self.debug_text.insert(tk.END, message + "\n")
        self.debug_text.see(tk.END)
        self.debug_text.update_idletasks()
    
    def clear_debug_info(self):
        """清除调试信息"""
        self.debug_text.delete(1.0, tk.END)
    
    def show_api_debug_info(self):
        """显示API请求和响应信息"""
        debug_window = tk.Toplevel(self.root)
        debug_window.title("API调试详情")
        debug_window.geometry("800x600")
        
        text = tk.Text(debug_window, wrap=tk.WORD)
        text.pack(fill=tk.BOTH, expand=True)
        
        text.insert(tk.END, "=== 最后一次API请求 ===\n")
        text.insert(tk.END, self.last_api_request + "\n\n")
        text.insert(tk.END, "=== 最后一次API响应 ===\n")
        text.insert(tk.END, self.last_api_response + "\n")
        
        scrollbar = ttk.Scrollbar(text)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        text.config(yscrollcommand=scrollbar.set)
        scrollbar.config(command=text.yview)
        
        text.config(state=tk.DISABLED)
    
    def get_current_location(self):
        """获取用户当前位置"""
        self.update_status("正在获取位置...")
        self.get_location_btn.config(state=tk.DISABLED)
        self.clear_debug_info()
        
        # 在新线程中获取位置，避免阻塞UI
        threading.Thread(target=self._get_location_thread, daemon=True).start()
    
    def _get_location_thread(self):
        try:
            # 使用geocoder获取当前位置
            self.log_debug_info("尝试通过IP获取地理位置...")
            g = geocoder.ip('me')
            
            self.log_debug_info(f"Geocoder响应: {g}")
            self.log_debug_info(f"状态: {'成功' if g.ok else '失败'}")
            
            if g.ok:
                self.current_location = g.address
                self.location_entry.delete(0, tk.END)
                self.location_entry.insert(0, self.current_location)
                self.get_impression_btn.config(state=tk.NORMAL)
                self.update_status(f"获取位置成功: {self.current_location}")
                self.log_debug_info(f"获取到位置: {self.current_location}")
                self.log_debug_info(f"坐标: {g.latlng}")
            else:
                self.update_status("无法获取当前位置")
                self.log_debug_info("错误: 无法获取当前位置")
                self.root.after(0, lambda: messagebox.showerror(
                    "错误", 
                    "无法获取当前位置，请手动输入\n" +
                    f"Geocoder错误: {g.error if hasattr(g, 'error') else '未知错误'}"
                ))
        except Exception as e:
            error_msg = f"获取位置出错: {str(e)}\n{traceback.format_exc()}"
            self.update_status("获取位置出错")
            self.log_debug_info(f"异常: {error_msg}")
            self.root.after(0, lambda: messagebox.showerror(
                "错误", 
                f"获取位置时出错:\n{str(e)}\n\n详细错误:\n{traceback.format_exc()}"
            ))
        finally:
            self.get_location_btn.config(state=tk.NORMAL)
    
    def get_ai_impression(self):
        """获取AI对位置的印象"""
        # 检查是否有位置信息
        manual_location = self.manual_location_entry.get().strip()
        if manual_location:
            self.current_location = manual_location
        elif not self.current_location:
            messagebox.showwarning("警告", "请先获取或输入位置信息")
            return
        
        self.update_status(f"正在获取AI对 {self.current_location} 的印象...")
        self.get_impression_btn.config(state=tk.DISABLED)
        self.clear_debug_info()
        
        # 在新线程中调用API
        threading.Thread(target=self._get_ai_impression_thread, daemon=True).start()
    
    def _get_ai_impression_thread(self):
        try:
            # 构建API请求URL
            prompt = f"请描述你对{self.current_location}的印象，用50字左右"
            params = {
                "message": prompt,
                "system": "你是一个旅行作家，擅长用生动的语言描述地点",
                "model": "false",
                "type": "json"
            }
            
            self.last_api_request = f"GET https://missqiu.cnunon.cn/api/GPT?{urllib.parse.urlencode(params)}"
            self.log_debug_info(f"构建ChatGPT API请求:\n{self.last_api_request}")
            
            url = "https://missqiu.cnunon.cn/api/GPT?" + urllib.parse.urlencode(params)
            
            # 发送请求
            self.log_debug_info("正在发送API请求...")
            with urllib.request.urlopen(url) as response:
                response_data = response.read().decode()
                self.last_api_response = response_data
                self.log_debug_info(f"收到API响应:\n{response_data}")
                
                data = json.loads(response_data)
                
                # 改进的判断逻辑：检查code是否为200或"200"
                if ("code" in data and (data["code"] == 200 or str(data["code"]) == "200")):
                    # 优先使用content字段，如果没有则使用msg字段
                    self.ai_impression = data.get("content", data.get("msg", "未获取到印象描述"))
                    self.log_debug_info(f"成功解析AI印象: {self.ai_impression}")
                    
                    # 更新UI
                    self.root.after(0, self._update_impression_ui)
                    self.update_status(f"成功获取AI对 {self.current_location} 的印象")
                    self.generate_image_btn.config(state=tk.NORMAL)
                else:
                    error_msg = f"API返回错误: {data.get('code', '未知错误码')} - {data.get('msg', '无错误信息')}"
                    self.update_status("获取AI印象失败")
                    self.log_debug_info(error_msg)
                    self.root.after(0, lambda: messagebox.showerror(
                        "错误", 
                        f"获取AI印象失败:\n{error_msg}\n\n完整响应:\n{response_data}"
                    ))
        except urllib.error.HTTPError as e:
            error_msg = f"HTTP错误: {e.code} - {e.reason}\n{e.read().decode()}"
            self.update_status(f"获取AI印象出错: HTTP {e.code}")
            self.log_debug_info(f"HTTP错误: {error_msg}")
            self.root.after(0, lambda: messagebox.showerror(
                "HTTP错误", 
                f"获取AI印象时发生HTTP错误:\n{e.code} - {e.reason}\n\n详细错误:\n{error_msg}"
            ))
        except urllib.error.URLError as e:
            error_msg = f"URL错误: {str(e)}\n{traceback.format_exc()}"
            self.update_status("获取AI印象出错: 网络问题")
            self.log_debug_info(f"URL错误: {error_msg}")
            self.root.after(0, lambda: messagebox.showerror(
                "网络错误", 
                f"获取AI印象时发生网络错误:\n{str(e)}\n\n请检查网络连接和API地址是否正确"
            ))
        except json.JSONDecodeError as e:
            error_msg = f"JSON解析错误: {str(e)}\n响应内容: {response_data if 'response_data' in locals() else '无'}"
            self.update_status("获取AI印象出错: 响应格式错误")
            self.log_debug_info(f"JSON解析错误: {error_msg}")
            self.root.after(0, lambda: messagebox.showerror(
                "格式错误", 
                f"解析AI印象响应时出错:\n{str(e)}\n\n请检查API返回的数据格式是否正确"
            ))
        except Exception as e:
            error_msg = f"未知错误: {str(e)}\n{traceback.format_exc()}"
            self.update_status(f"获取AI印象出错: {str(e)}")
            self.log_debug_info(f"未知错误: {error_msg}")
            self.root.after(0, lambda: messagebox.showerror(
                "错误", 
                f"获取AI印象时发生未知错误:\n{str(e)}\n\n详细错误:\n{traceback.format_exc()}"
            ))
        finally:
            self.root.after(0, lambda: self.get_impression_btn.config(state=tk.NORMAL))
    
    def _update_impression_ui(self):
        """更新印象文本显示"""
        self.impression_text.config(state=tk.NORMAL)
        self.impression_text.delete(1.0, tk.END)
        self.impression_text.insert(tk.END, self.ai_impression)
        self.impression_text.config(state=tk.DISABLED)
    
    def generate_image(self):
        """生成印象图片"""
        if not self.ai_impression:
            messagebox.showwarning("警告", "请先获取AI印象")
            return
        
        self.update_status("正在生成印象图片...")
        self.generate_image_btn.config(state=tk.DISABLED)
        self.clear_debug_info()
        
        # 在新线程中调用API
        threading.Thread(target=self._generate_image_thread, daemon=True).start()
    
    def _generate_image_thread(self):
        try:
            # 使用新的fluxschnellv2 API
            prompt = self.ai_impression
            params = {
                "prompt": prompt
            }
            
            self.last_api_request = f"GET https://missqiu.cnunon.cn/api/fluxschnellv2?{urllib.parse.urlencode(params)}"
            self.log_debug_info(f"构建fluxschnellv2 API请求:\n{self.last_api_request}")
            
            url = "https://missqiu.cnunon.cn/api/fluxschnellv2?" + urllib.parse.urlencode(params)
            
            # 发送请求
            self.log_debug_info("正在发送绘画API请求...")
            with urllib.request.urlopen(url) as response:
                response_data = response.read().decode()
                self.last_api_response = response_data
                self.log_debug_info(f"收到API响应:\n{response_data}")
                
                data = json.loads(response_data)
                
                # 检查状态码是否为0（fluxschnellv2的成功状态码）
                if "code" in data and data["code"] == 0:
                    # 获取图片URL
                    if "data" in data and "images" in data["data"] and len(data["data"]["images"]) > 0:
                        self.image_urls = [img["url"] for img in data["data"]["images"] if "url" in img]
                        self.log_debug_info(f"获取到图片URL: {len(self.image_urls)}个")
                        
                        if self.image_urls:
                            self.current_image_index = 0
                            self.root.after(0, self._display_image)
                            self.update_status("成功生成印象图片")
                            self.log_debug_info(f"第一张图片URL: {self.image_urls[0]}")
                        else:
                            error_msg = "API返回成功但未包含有效图片URL"
                            self.update_status("未获取到图片URL")
                            self.log_debug_info(error_msg)
                            self.root.after(0, lambda: messagebox.showerror(
                                "错误", 
                                f"{error_msg}\n\n完整响应:\n{response_data}"
                            ))
                    else:
                        error_msg = "API返回的数据结构不符合预期"
                        self.update_status("生成图片失败")
                        self.log_debug_info(error_msg)
                        self.root.after(0, lambda: messagebox.showerror(
                            "错误", 
                            f"生成图片失败:\n{error_msg}\n\n完整响应:\n{response_data}"
                        ))
                else:
                    error_msg = f"API返回错误: {data.get('code', '未知错误码')} - {data.get('msg', '无错误信息')}"
                    self.update_status("生成图片失败")
                    self.log_debug_info(error_msg)
                    self.root.after(0, lambda: messagebox.showerror(
                        "错误", 
                        f"生成图片失败:\n{error_msg}\n\n完整响应:\n{response_data}"
                    ))
        except urllib.error.HTTPError as e:
            error_msg = f"HTTP错误: {e.code} - {e.reason}\n{e.read().decode()}"
            self.update_status(f"生成图片出错: HTTP {e.code}")
            self.log_debug_info(f"HTTP错误: {error_msg}")
            self.root.after(0, lambda: messagebox.showerror(
                "HTTP错误", 
                f"生成图片时发生HTTP错误:\n{e.code} - {e.reason}\n\n详细错误:\n{error_msg}"
            ))
        except urllib.error.URLError as e:
            error_msg = f"URL错误: {str(e)}\n{traceback.format_exc()}"
            self.update_status("生成图片出错: 网络问题")
            self.log_debug_info(f"URL错误: {error_msg}")
            self.root.after(0, lambda: messagebox.showerror(
                "网络错误", 
                f"生成图片时发生网络错误:\n{str(e)}\n\n请检查网络连接和API地址是否正确"
            ))
        except json.JSONDecodeError as e:
            error_msg = f"JSON解析错误: {str(e)}\n响应内容: {response_data if 'response_data' in locals() else '无'}"
            self.update_status("生成图片出错: 响应格式错误")
            self.log_debug_info(f"JSON解析错误: {error_msg}")
            self.root.after(0, lambda: messagebox.showerror(
                "格式错误", 
                f"解析图片生成响应时出错:\n{str(e)}\n\n请检查API返回的数据格式是否正确"
            ))
        except Exception as e:
            error_msg = f"未知错误: {str(e)}\n{traceback.format_exc()}"
            self.update_status(f"生成图片出错: {str(e)}")
            self.log_debug_info(f"未知错误: {error_msg}")
            self.root.after(0, lambda: messagebox.showerror(
                "错误", 
                f"生成图片时发生未知错误:\n{str(e)}\n\n详细错误:\n{traceback.format_exc()}"
            ))
        finally:
            self.root.after(0, lambda: self.generate_image_btn.config(state=tk.NORMAL))
    
    def _display_image(self):
        """显示图片"""
        if not self.image_urls:
            return
        
        try:
            # 下载图片
            self.log_debug_info(f"正在下载图片: {self.image_urls[self.current_image_index]}")
            with urllib.request.urlopen(self.image_urls[self.current_image_index]) as response:
                image_data = response.read()
                self.log_debug_info(f"图片下载成功，大小: {len(image_data)}字节")
            
            # 打开并调整图片大小以适应画布
            img = Image.open(BytesIO(image_data))
            canvas_width = self.canvas.winfo_width()
            canvas_height = self.canvas.winfo_height()
            
            if canvas_width > 1 and canvas_height > 1:  # 确保画布已初始化
                img.thumbnail((canvas_width, canvas_height), Image.LANCZOS)
                self.log_debug_info(f"调整图片大小以适应画布: {img.size}")
            
            # 转换为Tkinter PhotoImage并显示
            photo = ImageTk.PhotoImage(img)
            self.image_references.append(photo)  # 保持引用
            
            # 清除画布并显示新图片
            self.canvas.delete("all")
            self.canvas.create_image(
                canvas_width // 2, 
                canvas_height // 2, 
                image=photo, 
                anchor=tk.CENTER
            )
            self.log_debug_info("图片显示成功")
            
            # 添加导航按钮
            if len(self.image_urls) > 1:
                prev_btn = ttk.Button(
                    self.canvas, 
                    text="<", 
                    command=self._show_prev_image,
                    width=2
                )
                next_btn = ttk.Button(
                    self.canvas, 
                    text=">", 
                    command=self._show_next_image,
                    width=2
                )
                
                self.canvas.create_window(
                    canvas_width // 4, 
                    canvas_height // 2, 
                    window=prev_btn,
                    anchor=tk.CENTER
                )
                self.canvas.create_window(
                    3 * canvas_width // 4, 
                    canvas_height // 2, 
                    window=next_btn,
                    anchor=tk.CENTER
                )
                self.log_debug_info("添加图片导航按钮")
            
        except urllib.error.URLError as e:
            error_msg = f"图片下载失败: {str(e)}"
            self.update_status("图片下载失败")
            self.log_debug_info(error_msg)
            messagebox.showerror("错误", f"图片下载失败:\n{str(e)}")
        except Exception as e:
            error_msg = f"图片显示失败: {str(e)}\n{traceback.format_exc()}"
            self.update_status("图片显示失败")
            self.log_debug_info(error_msg)
            messagebox.showerror("错误", f"图片显示时出错:\n{str(e)}")
    
    def _show_prev_image(self):
        """显示上一张图片"""
        if len(self.image_urls) > 1:
            self.current_image_index = (self.current_image_index - 1) % len(self.image_urls)
            self.log_debug_info(f"切换到上一张图片，索引: {self.current_image_index}")
            self._display_image()
    
    def _show_next_image(self):
        """显示下一张图片"""
        if len(self.image_urls) > 1:
            self.current_image_index = (self.current_image_index + 1) % len(self.image_urls)
            self.log_debug_info(f"切换到下一张图片，索引: {self.current_image_index}")
            self._display_image()

if __name__ == "__main__":
    root = tk.Tk()
    app = LocationImpressionsApp(root)
    root.mainloop()
