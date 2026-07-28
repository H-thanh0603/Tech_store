import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const inputDir = process.argv[2] ?? 'D:/tmp'
const imageDir = path.join(root, 'public', 'product-images', 'cellphones')
const seedPath = path.join(root, 'supabase', 'seeds', 'cellphones-products.sql')
const sourcePath = path.join(root, 'supabase', 'seeds', 'cellphones-products.sources.csv')

const sources = [
  { file: 'cellphones-laptop.html', categoryId: '10000000-0000-0000-0000-000000000001' },
  { file: 'cellphones-mobile.html', categoryId: '10000000-0000-0000-0000-000000000002' },
  { file: 'cellphones-monitor.html', categoryId: '10000000-0000-0000-0000-000000000006' },
  { file: 'cellphones-tablet.html', categoryId: '10000000-0000-0000-0000-00000000000a' },
]

const cardPattern = /<a(?=[^>]*class="product__link button__link")[^>]*href="(?:https:\/\/cellphones\.com\.vn)?(?<sourcePath>\/[^\"]+\.html)"[^>]*>(?<card>[\s\S]*?)<\/a>/g
const imagePattern = /<img src="(?<url>[^\"]+)"[^>]* alt="(?<alt>[^\"]+)"/
const pricePattern = /product__price--show">\s*(?<price>[\d.]+)đ/

function escapeSql(value) {
  return value.replaceAll("'", "''")
}

function id(prefix, index) {
  return `${prefix.padEnd(8, '0')}-0000-0000-0000-${index.toString(16).padStart(12, '0')}`
}

function extension(contentType) {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  return 'img'
}

async function collectProducts() {
  const products = []
  const seen = new Set()

  for (const source of sources) {
    const html = await readFile(path.join(inputDir, source.file), 'utf8')
    let match
    let selected = 0
    cardPattern.lastIndex = 0

    while ((match = cardPattern.exec(html)) && selected < 25) {
      const image = match.groups.card.match(imagePattern)
      const price = match.groups.card.match(pricePattern)
      const sourcePath = match.groups.sourcePath
      if (!image?.groups.url.startsWith('https://cdn2.cellphones.com.vn/') || !price || seen.has(sourcePath)) {
        continue
      }

      seen.add(sourcePath)
      selected += 1
      products.push({
        categoryId: source.categoryId,
        name: image.groups.alt,
        price: Number(price.groups.price.replaceAll('.', '')),
        sourcePage: `https://cellphones.com.vn${sourcePath}`,
        sourceImage: image.groups.url,
        slug: `cps-${path.basename(sourcePath, '.html')}`,
      })
    }

    if (selected !== 25) throw new Error(`${source.file}: expected 25 usable product cards, found ${selected}`)
  }

  if (products.length !== 100) throw new Error(`Expected 100 products, found ${products.length}`)
  return products
}

async function downloadImages(products) {
  await rm(imageDir, { recursive: true, force: true })
  await mkdir(imageDir, { recursive: true })

  for (const [index, product] of products.entries()) {
    const response = await fetch(product.sourceImage)
    if (!response.ok) throw new Error(`Image download failed (${response.status}): ${product.sourceImage}`)
    const file = `cps-${String(index + 1).padStart(3, '0')}.${extension(response.headers.get('content-type') ?? '')}`
    await writeFile(path.join(imageDir, file), new Uint8Array(await response.arrayBuffer()))
    product.localImage = `/product-images/cellphones/${file}`
  }
}

function sql(products) {
  const rows = (_prefix, mapper) => products.map((product, index) => `  ${mapper(product, index + 1)}`).join(',\n')
  const productId = (index) => id('31', index)
  const variantId = (index) => id('41', index)

  return `-- Generated from public CellphoneS category pages on 2026-07-26.\n-- Asset provenance is recorded in cellphones-products.sources.csv.\n\ninsert into categories (id, parent_id, name, slug, is_active) values\n  ('10000000-0000-0000-0000-00000000000a', null, 'Tablet', 'tablet', true)\non conflict (id) do nothing;\n\ninsert into products (id, category_id, brand_id, name, slug, description, is_published, is_featured, is_archived) values\n${rows('310', (product, index) => `('${productId(index)}', '${product.categoryId}', null, '${escapeSql(product.name)}', '${escapeSql(product.slug)}', 'Ảnh tham khảo từ CellphoneS cho mục đích trình diễn đồ án.', false, false, false)`)}\non conflict (id) do nothing;\n\ninsert into product_variants (id, product_id, sku, attributes, regular_price, sale_price, is_active) values\n${rows('410', (product, index) => `('${variantId(index)}', '${productId(index)}', 'CPS-${String(index).padStart(3, '0')}', '{}'::jsonb, ${product.price}, null, true)`)}\non conflict (id) do nothing;\n\ninsert into inventory (id, variant_id, quantity, reserved_quantity, low_stock_threshold) values\n${rows('510', (_product, index) => `('${id('510', index)}', '${variantId(index)}', 10, 0, 3)`)}\non conflict (id) do nothing;\n\ninsert into product_images (id, product_id, variant_id, url, alt_text, sort_order) values\n${rows('610', (product, index) => `('${id('610', index)}', '${productId(index)}', null, '${product.localImage}', '${escapeSql(product.name)}', 0)`)}\non conflict (id) do nothing;\n\nupdate products set is_published = true\nwhere id in (\n${products.map((_product, index) => `  '${productId(index + 1)}'`).join(',\n')}\n);\n`
}

function csv(products) {
  const quote = (value) => `"${value.replaceAll('"', '""')}"`
  return ['name,category_id,source_page,source_image,local_image', ...products.map((product) => [product.name, product.categoryId, product.sourcePage, product.sourceImage, product.localImage].map(quote).join(','))].join('\n') + '\n'
}

const products = await collectProducts()
await downloadImages(products)
await mkdir(path.dirname(seedPath), { recursive: true })
await writeFile(seedPath, sql(products))
await writeFile(sourcePath, csv(products))

console.log(`Imported ${products.length} products and ${products.length} local images.`)
