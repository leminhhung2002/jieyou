export const news = [1, 2, 3].map((id) => ({
  id,
  slug: `tieu-de-bai-viet-${id}`,
  title: 'Tiêu đề bài viết',
  excerpt: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit enim urna porttitor neque elementum cursus.',
  tag: 'Tài trợ',
  publishedAt: '2026-10-19',
  image: null, // null -> frontend dùng ảnh mặc định của thiết kế
}));
