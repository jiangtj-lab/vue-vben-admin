import { requestClient } from '#/api/request';

export namespace PicApi {
  /** 图片上传结果（POST /pic/upload） */
  export interface UploadResult {
    /** 服务端生成的新文件名 */
    fileName?: string;
    /** 文件访问地址 */
    fileUrl?: string;
    /** 原始文件名 */
    originalFileName?: string;
    /** 缩略图地址（服务商生成时才有） */
    thumbnailUrl?: string;
  }
}

/**
 * 上传图片
 * @param target 上传目录标识，需存在于 jmicro.pic.upload.dirs 配置中，如 cover
 * @param file 图片文件
 */
export async function uploadPicApi(target: string, file: File) {
  return requestClient.upload<PicApi.UploadResult>('/pic/upload', {
    file,
    target,
  });
}
