/* eslint-env node */
const eslint = require('gulp-eslint')
const gulp = require('gulp')
const gulpif = require('gulp-if')
const uglify = require('gulp-uglify-es').default
const rename = require('gulp-rename')
const inject = require('gulp-inject')
const shell = require('gulp-shell')
const source = require('vinyl-source-stream')
const buffer = require('vinyl-buffer')
const browserify = require('browserify')
const series = require('stream-series')
const merge = require('merge-stream')
const argv = require('yargs').argv

let DEST = ''
const DEST_DEBUG = './build/debug/'
const DEST_RELEASE = './build/release/'
const VENDOR = './src/vendor/'
const APP = './src/app/'

gulp.task('set_build_dir', function () {
  if (argv.debug) {
    DEST = DEST_DEBUG
  } else {
    DEST = DEST_RELEASE
  }
})

gulp.task('lint', ['set_build_dir'], function () {
  return gulp.src(APP + 'js/*.js')
    .pipe(gulpif(!argv.debug, buffer()))
    .pipe(gulpif(!argv.debug, eslint()))
    .pipe(gulpif(!argv.debug, eslint.format()))
    .pipe(gulpif(!argv.debug, eslint.failAfterError()))
})

gulp.task('semantic_build', ['lint'], shell.task('gulp build', { cwd: VENDOR + 'semantic' }))

gulp.task('semantic', argv.debug ? ['lint'] : ['lint', 'semantic_build'], function () {
  const components = gulp.src(VENDOR + 'semantic/dist/components/*.min*')
    .pipe(gulp.dest(DEST + 'vendor/semantic/components'))

  const data = gulp.src(VENDOR + 'semantic/dist/*.min*')
    .pipe(gulp.dest(DEST + 'vendor/semantic'))

  const themes = gulp.src(VENDOR + 'semantic/dist/themes/**/*')
    .pipe(gulp.dest(DEST + 'vendor/semantic/themes'))

  return merge(components, data, themes)
})

// Build iota
gulp.task('iota', ['lint'], function () {
  return browserify(VENDOR + 'iota/iota.browser.js')
    .bundle()
    .pipe(source('iota.js'))
    .pipe(gulpif(!argv.debug, buffer()))
    .pipe(gulpif(!argv.debug, uglify()))
    .pipe(gulpif(!argv.debug, rename('iota.min.js')))
    .pipe(gulp.dest(DEST + 'vendor/iota'))
})

// Build app
gulp.task('app', ['lint'], function () {
  return browserify(APP + 'js/index.js')
    .bundle()
    .pipe(source('app.js'))
    .pipe(gulpif(!argv.debug, buffer()))
    .pipe(gulpif(!argv.debug, uglify({ compress: { inline: false } })))
    .pipe(gulpif(!argv.debug, rename('app.min.js')))
    .pipe(gulp.dest(DEST + 'app/js'))
})

// Copy jQuery
gulp.task('jquery', ['lint'], function () {
  return gulp.src(VENDOR + 'jquery/*.js')
    .pipe(gulp.dest(DEST + 'vendor/jquery'))
})

gulp.task('inject', ['semantic', 'iota', 'app', 'jquery'], function () {
  const jqueryStream = gulp.src([DEST + 'vendor/jquery/*.js'], { read: false })
  const semanticStream = gulp.src([DEST + 'vendor/semantic/*.js', DEST + 'vendor/semantic/*.css'], { read: false })
  const iotaStream = gulp.src([DEST + 'vendor/iota/*.js'], { read: false })

  const appStream = !argv.debug
    ? gulp.src([DEST + 'app/js/*.js'], { read: false })
    : gulp.src([APP + 'js/*.js', '!' + APP + 'js/index.js'], { read: false })

  const ignorePath = DEST.substr(1, DEST.length)

  return gulp.src('./src/index.html')
    .pipe(inject(series(jqueryStream, semanticStream, iotaStream), {
      ignorePath,
      addRootSlash: false,
      starttag: '<!-- inject:head:vendor:{{ext}} -->',
      transform
    }))
    .pipe(gulpif(argv.debug, inject(appStream, {
      addPrefix: './../..',
      addRootSlash: false,
      starttag: '<!-- inject:head:app:{{ext}} -->',
      transform
    })))
    .pipe(gulpif(!argv.debug, inject(appStream, {
      ignorePath,
      addRootSlash: false,
      starttag: '<!-- inject:head:app:{{ext}} -->',
      transform
    })))
    .pipe(inject(gulp.src([APP + 'layout/modal/*.html']), {
      starttag: '<!-- inject:modal -->',
      transform
    }))
    .pipe(inject(gulp.src([APP + 'layout/steps/*.html']), {
      starttag: '<!-- inject:steps -->',
      transform
    }))
    .pipe(gulp.dest(DEST))
})

function transform (path, file) {
  if (path.endsWith('.html')) {
    return file.contents.toString('utf8')
  }
  if (path.endsWith('.js')) {
    return `<script src="${path}" defer></script>`
  }
  if (path.endsWith('.css')) {
    return `<link rel="stylesheet" href="${path}">`
  }
}

gulp.task('build', ['set_build_dir', 'lint', 'semantic', 'iota', 'app', 'jquery', 'inject'])
